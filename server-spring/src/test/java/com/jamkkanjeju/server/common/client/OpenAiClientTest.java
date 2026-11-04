package com.jamkkanjeju.server.common.client;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

import com.jamkkanjeju.server.common.config.OpenAiProperties;
import com.jamkkanjeju.server.common.image.ImageValidator.ImageFormat;
import com.jamkkanjeju.server.common.image.ImageValidator.ValidatedImage;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.List;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.mock.http.client.MockClientHttpRequest;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.json.JsonMapper;

/** 실제 비용·키·DB 없이 HTTP 요청 계약과 활성화 차단·응답 검증을 확인한다. */
class OpenAiClientTest {
    private RestClient.Builder builder;
    private MockRestServiceServer server;
    private byte[] png;

    @BeforeEach
    void setUp() throws IOException {
        builder = RestClient.builder().baseUrl("https://example.invalid/v1");
        server = MockRestServiceServer.bindTo(builder).build();
        var output = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(1, 1, BufferedImage.TYPE_INT_RGB), "png", output);
        png = output.toByteArray();
    }

    @Test
    void 참조이미지와생성설정을보내고_PNG한장을복원한다() {
        String encoded = Base64.getEncoder().encodeToString(png);
        server.expect(requestTo("https://example.invalid/v1/images/edits"))
                .andExpect(method(HttpMethod.POST)).andExpect(header("Authorization", "Bearer test-key"))
                .andExpect(content().contentTypeCompatibleWith(MediaType.MULTIPART_FORM_DATA))
                .andExpect(request -> {
                    String body = ((MockClientHttpRequest) request).getBodyAsString(StandardCharsets.UTF_8);
                    assertThat(body).contains("name=\"model\"", "gpt-image-2", "name=\"prompt\"", "test prompt",
                            "name=\"n\"", "name=\"size\"", "1024x1536", "name=\"output_format\"",
                            "name=\"image[]\"", "input-1.png", "input-2.png", "image/png");
                }).andRespond(withSuccess("{\"data\":[{\"b64_json\":\"" + encoded + "\"}]}", MediaType.APPLICATION_JSON));
        var image = new ValidatedImage(png, ImageFormat.PNG);
        assertThat(client(true, "test-key").editImage("test prompt", List.of(image, image))).isEqualTo(png);
        server.verify();
    }

    @Test
    void 비활성은키가있어도외부호출을차단한다() {
        OpenAiClient client = client(false, "test-key");
        assertThat(client.isEnabled()).isFalse();
        assertThatThrownBy(() -> client.editImage("prompt", images())).isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("비활성화");
        server.verify();
    }

    @Test
    void 키가없으면외부호출을차단한다() {
        assertThatThrownBy(() -> client(true, "").editImage("prompt", images()))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("인증키");
        server.verify();
    }

    @Test
    void 프롬프트나참조이미지가없으면호출하지않는다() {
        var client = client(true, "test-key");
        assertThatThrownBy(() -> client.editImage(" ", images())).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> client.editImage("prompt", List.of())).isInstanceOf(IllegalArgumentException.class);
        server.verify();
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "bad json", "{}", "{\"data\":[]}", "{\"data\":[{},{}]}",
            "{\"data\":[{\"url\":\"https://example.invalid/image.png\"}]}",
            "{\"data\":[{\"b64_json\":\"bad base64!\"}]}",
            "{\"data\":[{\"b64_json\":\"aGVsbG8=\"}]}",
            "{\"data\":[{\"b64_json\":\"iVBORw0KGgo=\"}]}"})
    void 잘못된응답은이미지로반환하지않는다(String response) {
        server.expect(requestTo("https://example.invalid/v1/images/edits"))
                .andRespond(withSuccess(response, MediaType.APPLICATION_JSON));
        assertThatThrownBy(() -> client(true, "test-key").editImage("prompt", images()))
                .isInstanceOf(IllegalStateException.class).hasMessage("OpenAI 이미지 생성에 실패했습니다.");
        server.verify();
    }

    @Test
    void HTTP오류본문의비밀정보를예외로전파하지않는다() {
        server.expect(requestTo("https://example.invalid/v1/images/edits"))
                .andRespond(withServerError().body("test-key and private prompt"));
        assertThatThrownBy(() -> client(true, "test-key").editImage("prompt", images()))
                .isInstanceOf(IllegalStateException.class).hasNoCause()
                .hasMessageNotContaining("test-key").hasMessageNotContaining("private prompt");
        server.verify();
    }

    @Test
    void 통신실패도비밀정보없이실패한다() {
        server.expect(requestTo("https://example.invalid/v1/images/edits"))
                .andRespond(request -> { throw new IOException("private prompt"); });
        assertThatThrownBy(() -> client(true, "test-key").editImage("prompt", images()))
                .isInstanceOf(IllegalStateException.class).hasNoCause().hasMessageNotContaining("private prompt");
        server.verify();
    }

    @Test
    void 설정객체출력에키를노출하지않는다() {
        assertThat(properties(true, "secret-api-key").toString()).doesNotContain("secret-api-key").contains("apiKey=***");
    }

    private List<ValidatedImage> images() { return List.of(new ValidatedImage(png, ImageFormat.PNG)); }

    private OpenAiClient client(boolean enabled, String key) {
        return new OpenAiClient(builder.build(), properties(enabled, key), JsonMapper.builder().build());
    }

    private OpenAiProperties properties(boolean enabled, String key) {
        return new OpenAiProperties(enabled, key, "https://example.invalid/v1", "gpt-image-2",
                Duration.ofSeconds(1), Duration.ofSeconds(2));
    }
}
