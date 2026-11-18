package com.jamkkanjeju.server.common.client;

import com.jamkkanjeju.server.common.config.TourApiProperties;
import java.net.URI;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** 장소 목록에 포함된 대표 사진을 전체 검증하여 개별 사진 API 호출 없이 사전 적재에 사용한다. */
@Component
public class TourApiLocationImageClient {
    private static final Set<String> CATEGORIES = Set.of("EV", "EX", "FD", "SH", "VE", "LS");
    private static final int PAGE_SIZE = 1000;
    private final RestClient client;
    private final TourApiProperties properties;
    private final JsonMapper mapper;

    public TourApiLocationImageClient(@Qualifier("tourApiRestClient") RestClient client,
                                      TourApiProperties properties, JsonMapper mapper) {
        this.client = client;
        this.properties = properties;
        this.mapper = mapper;
    }

    public record LocationImage(long contentId, String imageUrl) {}

    /** 모든 페이지가 검증된 경우에만 결과를 반환한다. heartbeat는 잠금 소유권을 확인·연장한다. */
    public List<LocationImage> getJejuImages(Runnable heartbeat) {
        if (!StringUtils.hasText(properties.serviceKey())) throw new IllegalStateException("TourAPI 키 미설정");
        List<LocationImage> result = new ArrayList<>();
        Set<Long> ids = new HashSet<>();
        int total = -1;
        int fetched = 0;
        for (int page = 1; total < 0 || fetched < total; page++) {
            heartbeat.run();
            int requestedPage = page;
            JsonNode response = mapper.readTree(client.get().uri(builder -> builder.path("/areaBasedList2")
                    .queryParam("serviceKey", "{key}").queryParam("MobileOS", "{os}")
                    .queryParam("MobileApp", "{app}").queryParam("_type", "json")
                    .queryParam("lDongRegnCd", "50").queryParam("numOfRows", PAGE_SIZE)
                    .queryParam("pageNo", requestedPage)
                    .build(Map.of("key", properties.serviceKey(), "os", properties.mobileOs(), "app", properties.mobileApp())))
                    .retrieve().body(String.class)).path("response");
            heartbeat.run();
            require("0000".equals(text(response.path("header").path("resultCode"))));
            JsonNode body = response.path("body");
            int count = integer(body.path("totalCount"));
            require(count > 0 && (total < 0 || total == count) && integer(body.path("pageNo")) == page);
            total = count;
            JsonNode items = body.path("items").path("item");
            List<JsonNode> rows = new ArrayList<>();
            if (items.isObject()) rows.add(items);
            else if (items.isArray()) items.forEach(rows::add);
            else require(false);
            require(rows.size() == Math.min(PAGE_SIZE, total - fetched));
            int returnedSize = integer(body.path("numOfRows"));
            require(returnedSize == PAGE_SIZE || returnedSize == rows.size());
            for (JsonNode row : rows) {
                require(row.isObject());
                long id = Long.parseLong(text(row.path("contentid")));
                require(id > 0 && ids.add(id) && "50".equals(text(row.path("lDongRegnCd"))));
                if (!CATEGORIES.contains(text(row.path("lclsSystm1")))) continue;
                String url = imageUrl(row.path("firstimage"));
                if (url == null) url = imageUrl(row.path("firstimage2"));
                result.add(new LocationImage(id, url));
            }
            fetched += rows.size();
        }
        require(fetched == total && !result.isEmpty());
        return List.copyOf(result);
    }

    private static int integer(JsonNode node) { return Integer.parseInt(text(node)); }

    private static String text(JsonNode node) {
        if (node.isString()) return node.asString().trim();
        return node.isNumber() ? node.toString() : null;
    }

    private static String imageUrl(JsonNode node) {
        require(node.isMissingNode() || node.isNull() || node.isString());
        String value = text(node);
        if (!StringUtils.hasText(value)) return null;
        URI uri = URI.create(value);
        require(("http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme()))
                && uri.getHost() != null);
        return value;
    }

    private static void require(boolean valid) {
        if (!valid) throw new IllegalStateException("TourAPI 장소 목록 전체 검증 실패");
    }
}
