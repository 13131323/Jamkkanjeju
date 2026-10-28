package com.jamkkanjeju.server.domain.guestbook.integration;

import static com.jamkkanjeju.server.domain.guestbook.support.GuestbookFixtures.*;
import static com.jamkkanjeju.server.domain.treasurehunt.support.PictureFixtures.image;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

import com.jamkkanjeju.server.domain.guestbook.support.GuestbookIntegrationTestSupport;
import com.jayway.jsonpath.JsonPath;
import java.io.ByteArrayOutputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Arrays;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** 실제 서블릿에서 두 파일의 개별 10MB 한도와 오디오 시간·손상 검증을 확인한다. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {"app.blob-storage.container=media", "logging.level.org.hibernate.SQL=warn"})
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class CreateGuestbookHttpIntegrationTest extends GuestbookIntegrationTestSupport {
    @LocalServerPort int port;

    @Test void 이미지와오디오_각각10MB를_동시에_저장한다() throws Exception {
        HttpResponse<String> response = send(Arrays.copyOf(image("PNG"), 10_000_000), wav(1, 10_000_000), true);
        assertThat(response.statusCode()).isEqualTo(201); assertThat(rows()).hasSize(1);
        assertThat(rows().getFirst().get("audio_title")).isEqualTo("사용자 제목");
        verify(storage, times(2)).upload(any(), anyString(), anyString()); verify(storage, never()).delete(anyString());
    }

    @ParameterizedTest @ValueSource(booleans = {false, true})
    void 파일별_한바이트초과는_각각의_용량오류다(boolean audio) throws Exception {
        HttpResponse<String> response = send(audio ? null : new byte[10_000_001], audio ? new byte[10_000_001] : null, true);
        check(response, audio ? "AUDIO_SIZE_EXCEEDED" : "IMAGE_SIZE_EXCEEDED",
                audio ? "오디오 파일은 10MB를 초과할 수 없습니다." : "이미지 파일은 10MB를 초과할 수 없습니다.");
        assertThat(rows()).isEmpty(); verifyNoInteractions(storage);
    }

    @Test void 정확히30초는_허용하고_시간초과와_손상은_개별400이다() throws Exception {
        assertThat(send(null, wav(30, 0), true).statusCode()).isEqualTo(201);
        clearInvocations(storage);
        check(send(null, wav(30.001, 0), true), "AUDIO_DURATION_EXCEEDED", "오디오 재생 시간은 30초를 초과할 수 없습니다.");
        check(send(null, Arrays.copyOf(audio("WAV"), 44), true), "INVALID_AUDIO", "손상되었거나 올바르지 않은 오디오 파일입니다.");
        assertThat(rows()).hasSize(1); verifyNoInteractions(storage);
    }

    @Test void boundary없는_multipart는_공통400이다() throws Exception {
        check(send(null, audio("MP3"), false), "INVALID_REQUEST", "요청값이 올바르지 않습니다.");
        assertThat(rows()).isEmpty(); verifyNoInteractions(storage);
    }

    private void check(HttpResponse<String> response, String code, String message) {
        assertThat(response.statusCode()).isEqualTo(400);
        assertThat((String) JsonPath.read(response.body(), "$.code")).isEqualTo(code);
        assertThat((String) JsonPath.read(response.body(), "$.message")).isEqualTo(message);
    }

    /** 실제 HTTP 서버에만 고정 boundary와 사용자 입력·바이트 파일을 전송한다. */
    private HttpResponse<String> send(byte[] image, byte[] audio, boolean boundaryIncluded) throws Exception {
        String boundary = "guestbook-test-boundary";
        ByteArrayOutputStream body = new ByteArrayOutputStream();
        for (String[] field : new String[][]{{"guestbookType", "ROAD"}, {"visitedAt", DATE.toString()}, {"locationAlias", "바다"},
                {"latitude", "33"}, {"longitude", "126"}, {"audioTitle", "사용자 제목"}}) {
            body.write(("--" + boundary + "\r\nContent-Disposition: form-data; name=\"" + field[0] + "\"\r\n\r\n" + field[1] + "\r\n").getBytes(StandardCharsets.UTF_8));
        }
        if (image != null) part(body, boundary, "imageFile", image);
        if (audio != null) part(body, boundary, "audioFile", audio);
        body.write(("--" + boundary + "--\r\n").getBytes(StandardCharsets.US_ASCII));
        HttpRequest request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + URL)).timeout(Duration.ofSeconds(45))
                .header("Authorization", bearer(current))
                .header("Content-Type", "multipart/form-data" + (boundaryIncluded ? "; boundary=" + boundary : ""))
                .POST(HttpRequest.BodyPublishers.ofByteArray(body.toByteArray())).build();
        try (HttpClient client = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).build()) {
            return client.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        }
    }

    private void part(ByteArrayOutputStream body, String boundary, String name, byte[] data) throws Exception {
        body.write(("--" + boundary + "\r\nContent-Disposition: form-data; name=\"" + name + "\"; filename=\"untrusted.bin\"\r\n"
                + "Content-Type: application/octet-stream\r\n\r\n").getBytes(StandardCharsets.US_ASCII));
        body.write(data); body.write("\r\n".getBytes(StandardCharsets.US_ASCII));
    }
}
