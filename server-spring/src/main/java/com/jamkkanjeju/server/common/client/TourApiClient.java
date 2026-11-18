package com.jamkkanjeju.server.common.client;

import com.jamkkanjeju.server.common.config.TourApiProperties;
import java.math.BigInteger;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.util.HtmlUtils;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** TourAPI에서 장소 대표·상세 이미지와 설명을 조회한다. 부가 정보 조회 실패 시 null을 반환한다. */
@Slf4j
@Component
public class TourApiClient {

    private static final int DETAIL_IMAGE_ROWS = 20;

    private final RestClient restClient;
    private final TourApiProperties properties;
    private final JsonMapper jsonMapper;

    public TourApiClient(@Qualifier("tourApiRestClient") RestClient restClient,
                         TourApiProperties properties, JsonMapper jsonMapper) {
        this.restClient = restClient;
        this.properties = properties;
        this.jsonMapper = jsonMapper;
    }

    /** 기존 호출자는 이미지 조회 실패도 null로 처리한다. 지도 캐시는 lookupLocationImage의 상태를 구분한다. */
    public String getLocationImageUrl(Long contentId) {
        return lookupLocationImage(contentId).imageUrl();
    }

    /** 한 번의 외부 요청에서 정상 사진 없음과 호출 실패를 분리한다. 재시도 여부는 호출자가 결정한다. */
    public TourApiImageResult lookupLocationImage(Long contentId) {
        if (contentId == null || contentId <= 0 || !StringUtils.hasText(properties.serviceKey())) {
            return TourApiImageResult.failed(false);
        }
        try {
            String raw = restClient.get()
                    .uri(builder -> builder.path("/detailCommon2")
                            .queryParam("serviceKey", "{serviceKey}")
                            .queryParam("MobileOS", "{mobileOs}")
                            .queryParam("MobileApp", "{mobileApp}")
                            .queryParam("_type", "json")
                            .queryParam("contentId", "{contentId}")
                            .build(Map.of("serviceKey", properties.serviceKey(), "mobileOs", properties.mobileOs(),
                                    "mobileApp", properties.mobileApp(), "contentId", contentId)))
                    .retrieve().body(String.class);
            if (!StringUtils.hasText(raw)) return TourApiImageResult.failed(false);
            JsonNode response = jsonMapper.readTree(raw).path("response");
            if (!"0000".equals(text(response.path("header").path("resultCode")))) {
                return TourApiImageResult.failed(false);
            }
            JsonNode body = response.path("body");
            JsonNode countNode = body.path("totalCount");
            int count = Integer.parseInt(countNode.isString() ? countNode.asString() : countNode.toString());
            JsonNode items = body.path("items").path("item");
            if (count == 0) {
                return items.isMissingNode() || items.isNull() || (items.isArray() && items.isEmpty())
                        ? TourApiImageResult.noImage() : TourApiImageResult.failed(false);
            }
            if (count != 1 || (items.isArray() && items.size() != 1)) return TourApiImageResult.failed(false);
            JsonNode item = items.isArray() ? items.get(0) : items;
            if (!item.isObject()) return TourApiImageResult.failed(false);
            JsonNode idNode = item.path("contentid");
            long actualId = Long.parseLong(idNode.isString() ? idNode.asString() : idNode.toString());
            if (actualId != contentId) return TourApiImageResult.failed(false);
            for (String field : List.of("firstimage", "firstimage2")) {
                JsonNode value = item.path(field);
                if (!value.isMissingNode() && !value.isNull() && !value.isString()) {
                    return TourApiImageResult.failed(false);
                }
            }
            String url = text(item.path("firstimage"));
            if (url == null) url = text(item.path("firstimage2"));
            return url == null ? TourApiImageResult.noImage() : TourApiImageResult.found(url);
        } catch (RestClientResponseException exception) {
            int status = exception.getStatusCode().value();
            log.warn("TourAPI 이미지 HTTP 오류: contentId={}, status={}", contentId, status);
            if (status == 429) {
                long retryAfter = 60;
                if (exception.getResponseHeaders() != null) {
                    try {
                        retryAfter = Long.parseLong(exception.getResponseHeaders().getFirst("Retry-After"));
                    } catch (NumberFormatException ignored) {
                        // 초 단위 Retry-After가 없으면 최소 60초 동안 호출을 중단한다.
                    }
                }
                return TourApiImageResult.rateLimited(retryAfter);
            }
            return TourApiImageResult.failed(status == 408 || status >= 500);
        } catch (ResourceAccessException exception) {
            log.warn("TourAPI 이미지 통신 오류: contentId={}", contentId);
            return TourApiImageResult.failed(true);
        } catch (RuntimeException exception) {
            // 외부 요청 URL·응답 원문에 인증키가 포함될 수 있으므로 로그에 남기지 않는다.
            log.warn("TourAPI 이미지 응답 검증 실패: contentId={}, errorType={}", contentId, exception.getClass().getSimpleName());
            return TourApiImageResult.failed(false);
        }
    }

    /** 장소 설명의 HTML·엔티티·불필요한 공백을 정리한다. 설명을 제공하지 못하면 null을 반환한다. */
    public String getLocationOverview(Long contentId) {
        if (contentId == null || contentId <= 0) {
            log.warn("TourAPI 설명 조회 생략: 유효하지 않은 contentId={}", contentId);
            return null;
        }
        if (!StringUtils.hasText(properties.serviceKey())) {
            log.warn("TourAPI 설명 조회 생략: 인증키 미설정, contentId={}", contentId);
            return null;
        }
        try {
            String body = restClient.get()
                    .uri(builder -> builder.path("/detailCommon2")
                            .queryParam("serviceKey", "{serviceKey}")
                            .queryParam("MobileOS", "{mobileOs}")
                            .queryParam("MobileApp", "{mobileApp}")
                            .queryParam("_type", "json")
                            .queryParam("contentId", "{contentId}")
                            .build(Map.of(
                                    "serviceKey", properties.serviceKey(),
                                    "mobileOs", properties.mobileOs(),
                                    "mobileApp", properties.mobileApp(),
                                    "contentId", contentId)))
                    .retrieve()
                    .body(String.class);
            if (!StringUtils.hasText(body)) {
                log.warn("TourAPI 설명 조회 실패: 빈 응답, contentId={}", contentId);
                return null;
            }
            JsonNode response = jsonMapper.readTree(body).path("response");
            String resultCode = text(response.path("header").path("resultCode"));
            if (!"0000".equals(resultCode)) {
                log.warn("TourAPI 설명 조회 실패: API 오류 또는 응답 형식 오류, contentId={}, resultCode={}",
                        contentId, resultCode);
                return null;
            }
            JsonNode items = response.path("body").path("items").path("item");
            JsonNode item = items.isArray() ? items.path(0) : items;
            String overview = text(item.path("overview"));
            if (overview == null) {
                log.debug("TourAPI 장소 설명 없음: contentId={}", contentId);
                return null;
            }
            String cleaned = HtmlUtils.htmlUnescape(overview)
                    .replaceAll("(?is)<(script|style)\\b[^>]*>.*?</\\1\\s*>", " ")
                    .replaceAll("(?s)<[^>]*>", " ")
                    .replaceAll("[\\s\\p{Z}]+", " ")
                    .strip();
            return StringUtils.hasText(cleaned) ? cleaned : null;
        } catch (RestClientResponseException exception) {
            log.warn("TourAPI 설명 조회 실패: HTTP 오류, contentId={}, status={}",
                    contentId, exception.getStatusCode().value());
            return null;
        } catch (RuntimeException exception) {
            // 외부 요청의 인증키가 노출되지 않도록 예외 메시지와 응답 본문은 기록하지 않는다.
            log.warn("TourAPI 설명 조회 실패: 통신 또는 응답 처리 오류, contentId={}, errorType={}",
                    contentId, exception.getClass().getSimpleName());
            return null;
        }
    }

    /** 상세 이미지를 순번으로 정렬·중복 제거하여 최대 limit장 반환한다. 없거나 조회 실패 시 null이다. */
    public List<String> getLocationDetailImageUrls(Long contentId, int limit) {
        if (limit <= 0) {
            throw new IllegalArgumentException("상세 이미지 개수는 1 이상이어야 합니다.");
        }
        if (contentId == null || contentId <= 0) {
            log.warn("TourAPI 상세 이미지 조회 생략: 유효하지 않은 contentId={}", contentId);
            return null;
        }
        if (!StringUtils.hasText(properties.serviceKey())) {
            log.warn("TourAPI 상세 이미지 조회 생략: 인증키 미설정, contentId={}", contentId);
            return null;
        }
        try {
            String body = restClient.get()
                    .uri(builder -> builder.path("/detailImage2")
                            .queryParam("serviceKey", "{serviceKey}")
                            .queryParam("MobileOS", "{mobileOs}")
                            .queryParam("MobileApp", "{mobileApp}")
                            .queryParam("_type", "json")
                            .queryParam("contentId", "{contentId}")
                            .queryParam("imageYN", "Y")
                            .queryParam("numOfRows", DETAIL_IMAGE_ROWS)
                            .queryParam("pageNo", 1)
                            .build(Map.of("serviceKey", properties.serviceKey(), "mobileOs", properties.mobileOs(),
                                    "mobileApp", properties.mobileApp(), "contentId", contentId)))
                    .retrieve().body(String.class);
            if (!StringUtils.hasText(body)) {
                log.warn("TourAPI 상세 이미지 조회 실패: 빈 응답, contentId={}", contentId);
                return null;
            }
            JsonNode response = jsonMapper.readTree(body).path("response");
            String resultCode = text(response.path("header").path("resultCode"));
            if (!"0000".equals(resultCode)) {
                log.warn("TourAPI 상세 이미지 조회 실패: API 오류 또는 응답 형식 오류, contentId={}, resultCode={}",
                        contentId, resultCode);
                return null;
            }
            JsonNode items = response.path("body").path("items").path("item");
            List<JsonNode> sorted = new ArrayList<>();
            if (items.isArray()) {
                for (int index = 0; index < items.size(); index++) {
                    sorted.add(items.path(index));
                }
            } else if (items.isObject()) {
                sorted.add(items);
            }
            sorted.sort(Comparator.comparing(this::imageSerialNumber, Comparator.nullsLast(Comparator.naturalOrder())));
            LinkedHashSet<String> urls = new LinkedHashSet<>();
            for (JsonNode item : sorted) {
                String url = text(item.path("originimgurl"));
                if (url != null) {
                    urls.add(url);
                    if (urls.size() == limit) {
                        break;
                    }
                }
            }
            if (urls.isEmpty()) {
                log.debug("TourAPI 상세 이미지 없음: contentId={}", contentId);
                return null;
            }
            return List.copyOf(urls);
        } catch (RestClientResponseException exception) {
            log.warn("TourAPI 상세 이미지 조회 실패: HTTP 오류, contentId={}, status={}",
                    contentId, exception.getStatusCode().value());
            return null;
        } catch (RuntimeException exception) {
            // 외부 요청의 인증키가 노출되지 않도록 예외 메시지와 응답 본문은 기록하지 않는다.
            log.warn("TourAPI 상세 이미지 조회 실패: 통신 또는 응답 처리 오류, contentId={}, errorType={}",
                    contentId, exception.getClass().getSimpleName());
            return null;
        }
    }

    /** 숫자로 해석되지 않는 순번은 null로 두어 숫자 항목 뒤에서 원래 순서를 유지한다. */
    private BigInteger imageSerialNumber(JsonNode item) {
        JsonNode serial = item.path("serialnum");
        try {
            return new BigInteger((serial.isString() ? serial.asString() : serial.toString()).strip());
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    /** 누락·null·빈 문자열은 해당 부가 정보 없음으로 취급한다. */
    private String text(JsonNode node) {
        if (!node.isString()) {
            return null;
        }
        String value = node.asString();
        return StringUtils.hasText(value) ? value : null;
    }
}
