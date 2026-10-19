package com.jamkkanjeju.server.common.client;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

import com.jamkkanjeju.server.common.config.TourApiProperties;
import java.io.IOException;
import java.time.Duration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.json.JsonMapper;

/** 외부 연결 없이 장소 설명의 정리와 실패 시 null 처리를 검증한다. */
class TourApiOverviewClientTest {
    RestClient.Builder builder;
    MockRestServiceServer server;
    TourApiClient client;

    @BeforeEach
    void setUp() {
        builder = RestClient.builder().baseUrl("https://example.com");
        server = MockRestServiceServer.bindTo(builder).build();
        client = create("test-key");
    }

    @ParameterizedTest
    @ValueSource(booleans = {true, false})
    void 배열과_객체_응답의_HTML_엔티티_공백을_정리한다(boolean array) {
        var mapper = JsonMapper.builder().build();
        String item = mapper.writeValueAsString(java.util.Map.of("overview",
                "<style>숨김</style><script>숨김</script><p>제주&nbsp; &amp; 바다.</p>  다음 문장!"));
        respond("{\"response\":{\"header\":{\"resultCode\":\"0000\"},\"body\":{\"items\":{\"item\":"
                + (array ? "[" + item + "]" : item) + "}}}}");
        assertThat(client.getLocationOverview(123L)).isEqualTo("제주 & 바다. 다음 문장!");
        server.verify();
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "invalid json", "{}",
            "{\"response\":{\"header\":{\"resultCode\":\"9999\"}}}",
            "{\"response\":{\"header\":{\"resultCode\":\"0000\"},\"body\":{\"items\":{\"item\":[]}}}}",
            "{\"response\":{\"header\":{\"resultCode\":\"0000\"},\"body\":{\"items\":{\"item\":{\"overview\":\"<br>&nbsp;\"}}}}}"})
    void 설명없음과_잘못된응답은_null이다(String body) {
        respond(body);
        assertThat(client.getLocationOverview(123L)).isNull();
        server.verify();
    }

    @Test
    void 잘못된_ID와_키미설정은_외부호출을_생략한다() {
        assertThat(client.getLocationOverview(null)).isNull();
        assertThat(client.getLocationOverview(0L)).isNull();
        assertThat(client.getLocationOverview(-1L)).isNull();
        assertThat(create("").getLocationOverview(123L)).isNull();
        server.verify();
    }

    @Test
    void HTTP실패는_null이다() {
        server.expect(queryParam("contentId", "123")).andRespond(withServerError());
        assertThat(client.getLocationOverview(123L)).isNull();
        server.verify();
    }

    @Test
    void 통신실패는_null이다() {
        server.expect(queryParam("contentId", "123")).andRespond(withException(new IOException("test")));
        assertThat(client.getLocationOverview(123L)).isNull();
        server.verify();
    }

    /** 테스트 설정으로 클라이언트를 구성한다. */
    private TourApiClient create(String key) {
        return new TourApiClient(builder.build(), new TourApiProperties("https://example.com", key, "ETC", "test",
                Duration.ofSeconds(1), Duration.ofSeconds(1)), JsonMapper.builder().build());
    }

    /** 설명 조회 요청 파라미터를 검사하고 준비된 응답을 전달한다. */
    private void respond(String body) {
        server.expect(requestTo(org.hamcrest.Matchers.containsString("/detailCommon2?")))
                .andExpect(queryParam("contentId", "123")).andExpect(queryParam("overviewYN", "Y"))
                .andExpect(queryParam("serviceKey", "test-key")).andExpect(queryParam("MobileOS", "ETC"))
                .andExpect(queryParam("MobileApp", "test")).andExpect(queryParam("_type", "json"))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON));
    }
}
