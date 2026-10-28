package com.jamkkanjeju.server.common.client;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;
import com.jamkkanjeju.server.common.config.TourApiProperties;
import java.time.Duration;
import java.io.IOException;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.json.JsonMapper;

/** 외부 통신 없이 TourAPI 응답과 실패 시 이미지 null 처리를 검증한다. */
class TourApiClientTest {
    RestClient.Builder builder;MockRestServiceServer server;TourApiClient client;
    @BeforeEach void setup() {
        builder=RestClient.builder().baseUrl("https://example.com");
        server=MockRestServiceServer.bindTo(builder).build();client=create("test-key");
    }
    private TourApiClient create(String key) {
        return new TourApiClient(builder.build(),new TourApiProperties("https://example.com",key,"ETC","test",Duration.ofSeconds(1),Duration.ofSeconds(1)),JsonMapper.builder().build());
    }
    private void respond(String body) {
        server.expect(queryParam("contentId","123")).andExpect(queryParam("serviceKey","test-key"))
                .andRespond(withSuccess(body,MediaType.APPLICATION_JSON));
    }
    @Test void originalImageHasPriority() {
        respond("""
                {"response":{"header":{"resultCode":"0000"},"body":{"items":{"item":[{"firstimage":"original.png","firstimage2":"small.png"}]}}}}
                """);
        assertThat(client.getLocationImageUrl(123L)).isEqualTo("original.png");server.verify();
    }
    @Test void fallsBackToSmallImageAndAcceptsObjectItem() {
        respond("""
                {"response":{"header":{"resultCode":"0000"},"body":{"items":{"item":{"firstimage":"","firstimage2":"small.png"}}}}}
                """);
        assertThat(client.getLocationImageUrl(123L)).isEqualTo("small.png");server.verify();
    }
    @ParameterizedTest @ValueSource(strings={"", "invalid json", "{}", "{\"response\":{\"header\":{\"resultCode\":\"9999\"}}}", "{\"response\":{\"header\":{\"resultCode\":\"0000\"},\"body\":{\"items\":{\"item\":[]}}}}"})
    void missingImageOrInvalidResponseReturnsNull(String body) {
        respond(body);assertThat(client.getLocationImageUrl(123L)).isNull();server.verify();
    }
    @Test void missingKeyAndInvalidContentIdDoNotCallExternalApi() {
        assertThat(create("").getLocationImageUrl(123L)).isNull();
        assertThat(client.getLocationImageUrl(null)).isNull();assertThat(client.getLocationImageUrl(0L)).isNull();server.verify();
    }
    @Test void httpFailureReturnsNull() {
        server.expect(queryParam("contentId","123")).andRespond(withServerError());
        assertThat(client.getLocationImageUrl(123L)).isNull();server.verify();
    }
    @Test void networkFailureReturnsNull() {
        server.expect(queryParam("contentId","123")).andRespond(withException(new IOException("test failure")));
        assertThat(client.getLocationImageUrl(123L)).isNull();server.verify();
    }
}
