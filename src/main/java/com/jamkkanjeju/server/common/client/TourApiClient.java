package com.jamkkanjeju.server.common.client;

import com.jamkkanjeju.server.common.config.TourApiProperties;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** TourAPI에서 장소 대표 이미지를 조회한다. 이미지는 부가 정보이므로 조회 실패 시 null을 반환한다. */
@Slf4j
@Component
public class TourApiClient {

    private final RestClient restClient;
    private final TourApiProperties properties;
    private final JsonMapper jsonMapper;

    public TourApiClient(@Qualifier("tourApiRestClient") RestClient restClient,
                         TourApiProperties properties, JsonMapper jsonMapper) {
        this.restClient = restClient;
        this.properties = properties;
        this.jsonMapper = jsonMapper;
    }

    /** contentId의 대표 이미지 URL을 반환한다. 원본 이미지(firstimage)가 없으면 축소 이미지(firstimage2)를 사용한다. */
    public String getLocationImageUrl(Long contentId) {
        if (contentId == null || contentId <= 0) {
            log.warn("TourAPI 이미지 조회 생략: 유효하지 않은 contentId={}", contentId);
            return null;
        }
        if (!StringUtils.hasText(properties.serviceKey())) {
            log.warn("TourAPI 이미지 조회 생략: 인증키 미설정, contentId={}", contentId);
            return null;
        }

        try {
            // 인증키는 디코딩된 원문을 사용하고 URI 변수 확장 시 인코딩한다.
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
                log.warn("TourAPI 이미지 조회 실패: 빈 응답, contentId={}", contentId);
                return null;
            }

            JsonNode response = jsonMapper.readTree(body).path("response");
            String resultCode = text(response.path("header").path("resultCode"));
            if (!"0000".equals(resultCode)) {
                log.warn("TourAPI 이미지 조회 실패: API 오류 또는 응답 형식 오류, contentId={}, resultCode={}",
                        contentId, resultCode);
                return null;
            }

            JsonNode items = response.path("body").path("items").path("item");
            JsonNode item = items.isArray() ? items.path(0) : items;
            String imageUrl = text(item.path("firstimage"));
            if (imageUrl == null) {
                imageUrl = text(item.path("firstimage2"));
            }
            if (imageUrl == null) {
                log.debug("TourAPI 대표 이미지 없음: contentId={}", contentId);
            }
            return imageUrl;
        } catch (RestClientResponseException exception) {
            // 예외 메시지와 응답 본문에는 인증키 등 외부 요청 정보가 포함될 수 있어 기록하지 않는다.
            log.warn("TourAPI 이미지 조회 실패: HTTP 오류, contentId={}, status={}",
                    contentId, exception.getStatusCode().value());
            return null;
        } catch (RuntimeException exception) {
            log.warn("TourAPI 이미지 조회 실패: 통신 또는 응답 처리 오류, contentId={}, errorType={}",
                    contentId, exception.getClass().getSimpleName());
            return null;
        }
    }

    /** 누락·null·빈 문자열은 이미지 없음으로 취급한다. */
    private String text(JsonNode node) {
        if (!node.isString()) {
            return null;
        }
        String value = node.asString();
        return StringUtils.hasText(value) ? value : null;
    }
}
