package com.jamkkanjeju.server.common.client;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

import com.jamkkanjeju.server.common.config.TourApiProperties;
import java.time.Duration;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.junit.jupiter.api.*;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.json.JsonMapper;

/** 실제 API 없이 전체 목록 검증과 사진 URL 추출을 확인한다. */
class TourApiLocationImageClientTest {
    MockRestServiceServer server;
    TourApiLocationImageClient client;

    @BeforeEach void setUp() {
        var builder = RestClient.builder().baseUrl("https://example.com");
        server = MockRestServiceServer.bindTo(builder).build();
        client = new TourApiLocationImageClient(builder.build(), new TourApiProperties("https://example.com", "test-key",
                "ETC", "test", Duration.ofSeconds(1), Duration.ofSeconds(1)), JsonMapper.builder().build());
    }

    private String item(int id, String category, String region, String image) {
        return "{\"contentid\":\"" + id + "\",\"lDongRegnCd\":\"" + region
                + "\",\"lclsSystm1\":\"" + category + "\",\"firstimage\":\"" + image + "\"}";
    }

    private String body(int total, int page, int rows, String items) {
        return "{\"response\":{\"header\":{\"resultCode\":\"0000\"},\"body\":{\"totalCount\":" + total
                + ",\"pageNo\":" + page + ",\"numOfRows\":" + rows + ",\"items\":{\"item\":[" + items + "]}}}}";
    }

    private void respond(String json) {
        server.expect(queryParam("lDongRegnCd", "50")).andRespond(withSuccess(json, MediaType.APPLICATION_JSON));
    }

    @Test void usesLegalRegionAndDomainCategoriesAndKeepsNoUrlUnconfirmed() {
        respond(body(3, 1, 3, item(1, "FD", "50", "https://example.com/photo.jpg") + ","
                + item(2, "VE", "50", "") + "," + item(3, "AC", "50", "https://example.com/hotel.jpg")));
        var result = client.getJejuImages(() -> {});
        assertThat(result).hasSize(2);
        assertThat(result.getFirst().imageUrl()).isEqualTo("https://example.com/photo.jpg");
        assertThat(result.getLast().imageUrl()).isNull();
        server.verify();
    }

    @Test void duplicateContentIdsFailEntireCollection() {
        respond(body(2, 1, 2, item(1, "FD", "50", "") + "," + item(1, "FD", "50", "")));
        assertThatThrownBy(() -> client.getJejuImages(() -> {})).isInstanceOf(IllegalStateException.class);
    }

    @Test void missingRowsFailEntireCollection() {
        respond(body(3, 1, 2, item(1, "FD", "50", "") + "," + item(2, "FD", "50", "")));
        assertThatThrownBy(() -> client.getJejuImages(() -> {})).isInstanceOf(IllegalStateException.class);
    }

    @Test void otherRegionIsRejected() {
        respond(body(1, 1, 1, item(1, "FD", "11", "")));
        assertThatThrownBy(() -> client.getJejuImages(() -> {})).isInstanceOf(IllegalStateException.class);
    }

    @Test void changedTotalCountOnSecondPageIsRejected() {
        String first = IntStream.rangeClosed(1, 1000).mapToObj(id -> item(id, "FD", "50", "")).collect(Collectors.joining(","));
        respond(body(1001, 1, 1000, first));
        respond(body(1002, 2, 1, item(1001, "FD", "50", "")));
        assertThatThrownBy(() -> client.getJejuImages(() -> {})).isInstanceOf(IllegalStateException.class);
        server.verify();
    }

    @Test void successfulFullPaginationIncludesFinalActualRowCount() {
        String first = IntStream.rangeClosed(1, 1000).mapToObj(id -> item(id, "FD", "50", "")).collect(Collectors.joining(","));
        respond(body(1001, 1, 1000, first));
        respond(body(1001, 2, 1, item(1001, "FD", "50", "https://example.com/last.jpg")));
        assertThat(client.getJejuImages(() -> {})).hasSize(1001);
        server.verify();
    }

    @Test void httpRateLimitIsNotInterpretedAsEmptySuccess() {
        server.expect(queryParam("lDongRegnCd", "50")).andRespond(withStatus(HttpStatus.TOO_MANY_REQUESTS));
        assertThatThrownBy(() -> client.getJejuImages(() -> {})).isInstanceOf(RuntimeException.class);
    }
}
