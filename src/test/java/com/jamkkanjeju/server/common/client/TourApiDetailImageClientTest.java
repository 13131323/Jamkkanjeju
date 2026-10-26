package com.jamkkanjeju.server.common.client;

import static org.assertj.core.api.Assertions.assertThat;
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

/** 외부 연결 없이 상세 이미지 요청·순번·중복·부가 정보 실패를 검증한다. */
class TourApiDetailImageClientTest {
    RestClient.Builder builder;
    MockRestServiceServer server;
    TourApiClient client;

    @BeforeEach
    void setup() {
        builder = RestClient.builder().baseUrl("https://example.com");
        server = MockRestServiceServer.bindTo(builder).build();
        client = create("test-key");
    }

    private TourApiClient create(String key) {
        return new TourApiClient(builder.build(), new TourApiProperties("https://example.com", key, "ETC", "test",
                Duration.ofSeconds(1), Duration.ofSeconds(1)), JsonMapper.builder().build());
    }

    private void respond(String items) {
        server.expect(requestTo(org.hamcrest.Matchers.containsString("/detailImage2?")))
                .andExpect(queryParam("contentId", "123")).andExpect(queryParam("imageYN", "Y"))
                .andExpect(queryParam("numOfRows", "20")).andExpect(queryParam("pageNo", "1"))
                .andExpect(queryParam("serviceKey", "test-key"))
                .andRespond(withSuccess("{\"response\":{\"header\":{\"resultCode\":\"0000\"},\"body\":{\"items\":{\"item\":"
                        + items + "}}}}", MediaType.APPLICATION_JSON));
    }

    @Test
    void 숫자순번으로_정렬후_중복과_빈URL을_제외하고_최대5장을_반환한다() {
        respond("""
                [{"serialnum":"10","originimgurl":"ten.jpg"},
                 {"serialnum":"2","originimgurl":"two.jpg"},
                 {"serialnum":"1","originimgurl":"one.jpg"},
                 {"serialnum":"3","originimgurl":"two.jpg"},
                 {"serialnum":"4","originimgurl":"  "},
                 {"serialnum":"5","originimgurl":123},
                 {"serialnum":"6","originimgurl":"six.jpg"},
                 {"serialnum":"7","originimgurl":"seven.jpg"},
                 {"serialnum":"8","originimgurl":"eight.jpg"}]
                """);
        assertThat(client.getLocationDetailImageUrls(123L, 5))
                .containsExactly("one.jpg", "two.jpg", "six.jpg", "seven.jpg", "eight.jpg");
        server.verify();
    }

    @Test
    void 동일순번과_해석불가순번의_원래순서를_유지하며_URL을_변경하지_않는다() {
        respond("""
                [{"serialnum":"bad","originimgurl":"unknown-first.jpg"},
                 {"serialnum":2,"originimgurl":"number.jpg"},
                 {"serialnum":"2","originimgurl":"equal.jpg"},
                 {"originimgurl":"unknown-second.jpg"},
                 {"serialnum":"3","originimgurl":" spaced.jpg "}]
                """);
        assertThat(client.getLocationDetailImageUrls(123L, 5))
                .containsExactly("number.jpg", "equal.jpg", " spaced.jpg ", "unknown-first.jpg", "unknown-second.jpg");
        server.verify();
    }

    @Test
    void 객체응답과_부족한이미지는_있는만큼만_반환한다() {
        respond("{\"originimgurl\":\"only.jpg\",\"serialnum\":\"1\"}");
        assertThat(client.getLocationDetailImageUrls(123L, 5)).containsExactly("only.jpg");
        server.verify();
    }

    @ParameterizedTest
    @ValueSource(strings = {"[]", "{}", "[{\"firstimage\":\"representative.jpg\"}]", "[{\"originimgurl\":null}]"})
    void 상세이미지없음은_null이며_대표이미지를_대신쓰지_않는다(String items) {
        respond(items);
        assertThat(client.getLocationDetailImageUrls(123L, 5)).isNull();
        server.verify();
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "invalid json", "{}", "{\"response\":{\"header\":{\"resultCode\":\"9999\"}}}"})
    void 잘못된응답과_API오류는_null이다(String body) {
        server.expect(queryParam("contentId", "123")).andRespond(withSuccess(body, MediaType.APPLICATION_JSON));
        assertThat(client.getLocationDetailImageUrls(123L, 5)).isNull();
        server.verify();
    }

    @Test
    void 잘못된ID나_키없음은_호출을_생략한다() {
        assertThat(client.getLocationDetailImageUrls(null, 5)).isNull();
        assertThat(client.getLocationDetailImageUrls(0L, 5)).isNull();
        assertThat(create("").getLocationDetailImageUrls(123L, 5)).isNull();
        server.verify();
    }

    @Test
    void HTTP오류는_null이다() {
        server.expect(queryParam("contentId", "123")).andRespond(withServerError());
        assertThat(client.getLocationDetailImageUrls(123L, 5)).isNull();
        server.verify();
    }

    @Test
    void 통신오류는_null이다() {
        server.expect(queryParam("contentId", "123")).andRespond(withException(new IOException("test")));
        assertThat(client.getLocationDetailImageUrls(123L, 5)).isNull();
        server.verify();
    }
}
