package com.jamkkanjeju.server.domain.treasurehunt.integration;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static com.jamkkanjeju.server.domain.treasurehunt.support.PictureFixtures.*;

import com.jamkkanjeju.server.domain.treasurehunt.support.PictureIntegrationTestSupport;
import java.io.ByteArrayOutputStream;
import java.net.URI;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Arrays;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.transaction.annotation.*;
import tools.jackson.databind.json.JsonMapper;

/** 실제 서블릿 multipart 파싱과 HTTP 전송의 파일 크기 경계를 임의 포트 서버에서 검증한다. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {"app.blob-storage.container=test-media", "logging.level.org.hibernate.SQL=warn"})
@AutoConfigureMockMvc
@Import(PictureIntegrationTestSupport.FixedTime.class)
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class SavePictureWithCharacterHttpIntegrationTest extends PictureIntegrationTestSupport {
    @LocalServerPort int port;

    @Test
    void 실제_HTTP로_사진만_전송하면_204로_커밋한다() throws Exception {
        accepted(image("PNG"));
    }

    @Test
    void 정확히_천만바이트도_multipart_헤더와_함께_허용한다() throws Exception {
        accepted(Arrays.copyOf(image("PNG"), 10_000_000));
    }

    @Test
    void 실제파서의_파일크기초과는_개별400이다() throws Exception {
        rejected(Arrays.copyOf(image("PNG"), 10_000_001), true, "IMAGE_SIZE_EXCEEDED", "이미지 파일은 10MB를 초과할 수 없습니다.");
    }

    @Test
    void boundary없는_multipart는_공통400이다() throws Exception {
        rejected(image("PNG"), false, "INVALID_REQUEST", "요청값이 올바르지 않습니다.");
    }

    /** 실제 HTTP 성공 후 DB 반영과 파일 삭제 미호출을 확인하고 준비 데이터를 정리한다. */
    private void accepted(byte[] bytes) throws Exception {
        Data d = transactions.execute(status -> data());
        try {
            var response = send(d, bytes, true);
            assertThat(response.statusCode()).isEqualTo(204);
            assertThat(response.body()).isEmpty();
            assertThat(rows(d)).hasSize(2);
            assertThat(jdbc.queryForObject("select saved_at from picture_with_character where user_id=? and id<>?",
                    java.time.LocalDateTime.class, d.user().getId(), d.oldId())).isEqualTo(NOW);
            verify(storage).upload(eq(bytes), anyString(), eq("image/png"));
            verify(storage, never()).delete(anyString());
        } finally {
            clean(d);
        }
    }

    /** 실제 파서 오류가 명세의 JSON이고 업로드·DB 변경을 하지 않는지 검증한다. */
    private void rejected(byte[] bytes, boolean boundary, String code, String message) throws Exception {
        Data d = transactions.execute(status -> data());
        try {
            var before = snapshot(d);
            var response = send(d, bytes, boundary);
            assertThat(response.statusCode()).isEqualTo(400);
            var json = JsonMapper.builder().build().readTree(response.body());
            assertThat(json.get("code").asText()).isEqualTo(code);
            assertThat(json.get("message").asText()).isEqualTo(message);
            assertThat(rows(d)).hasSize(1);
            assertThat(snapshot(d)).isEqualTo(before);
            verifyNoInteractions(storage);
        } finally {
            clean(d);
        }
    }

    /** 고정 boundary로 실제 multipart 바이트를 구성하며 외부가 아닌 테스트 서버에만 보낸다. */
    private HttpResponse<String> send(Data d, byte[] bytes, boolean includeBoundary) throws Exception {
        String boundary = "picture-test-boundary";
        var body = new ByteArrayOutputStream();
        body.write(("--" + boundary + "\r\nContent-Disposition: form-data; name=\"picture\"; filename=\"image.png\"\r\n"
                + "Content-Type: image/png\r\n\r\n").getBytes(StandardCharsets.US_ASCII));
        body.write(bytes);
        body.write(("\r\n--" + boundary + "--\r\n").getBytes(StandardCharsets.US_ASCII));
        var request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + URL))
                .timeout(Duration.ofSeconds(30)).header("Authorization", bearer(d.user()))
                .header("Content-Type", "multipart/form-data" + (includeBoundary ? "; boundary=" + boundary : ""))
                .POST(HttpRequest.BodyPublishers.ofByteArray(body.toByteArray())).build();
        try (HttpClient client = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).build()) {
            return client.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        }
    }
}
