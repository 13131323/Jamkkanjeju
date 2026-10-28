package com.jamkkanjeju.server.domain.cooperativemission.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;
import static com.jamkkanjeju.server.domain.treasurehunt.support.PictureFixtures.image;
import com.jamkkanjeju.server.domain.cooperativemission.support.CooperativeMissionRoleProgressIntegrationSupport;
import java.io.ByteArrayOutputStream;
import java.net.URI;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Arrays;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.transaction.annotation.*;
import tools.jackson.databind.json.JsonMapper;

/** 실제 Tomcat multipart 파서의 파일 용량 경계와 파싱 오류를 확인한다. */
@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties={"app.dev-auth.enabled=false","app.blob-storage.container=test","logging.level.org.hibernate.SQL=warn"})
@Transactional(propagation=Propagation.NOT_SUPPORTED)
class SaveCooperativeMissionRoleProgressHttpIntegrationTest extends CooperativeMissionRoleProgressIntegrationSupport {
    @LocalServerPort int port;

    @Test void 정확히_천만바이트는_헤더크기와별개로_허용한다() throws Exception {
        var d=transactions.execute(tx -> data()); var before=snapshot(d.team().getId()).subList(0,2);
        byte[] bytes=Arrays.copyOf(image("PNG"),10_000_000);
        var response=send(d,bytes,true);
        assertThat(response.statusCode()).isEqualTo(200); assertThat(response.body()).isEqualTo("{\"isVerified\":true}");
        assertThat(assignmentRows(d.team().getId(),d.card().getId()).getFirst()).containsEntry("progress_status","COMPLETED");
        assertThat(snapshot(d.team().getId()).subList(0,2)).isEqualTo(before);
        verify(storage).upload(eq(bytes),anyString(),eq("image/png")); verify(storage,never()).delete(anyString());
    }
    @Test void 한바이트초과는_개별용량400이다() throws Exception { rejected(Arrays.copyOf(image("PNG"),10_000_001),true,"IMAGE_SIZE_EXCEEDED","이미지 파일은 10MB를 초과할 수 없습니다."); }
    @Test void boundary누락은_공통400이다() throws Exception { rejected(image("PNG"),false,"INVALID_REQUEST","요청값이 올바르지 않습니다."); }

    private void rejected(byte[] bytes,boolean boundary,String code,String message) throws Exception {
        var d=transactions.execute(tx -> data()); var before=snapshot(d.team().getId());
        var response=send(d,bytes,boundary); assertThat(response.statusCode()).isEqualTo(400);
        var json=JsonMapper.builder().build().readTree(response.body());
        assertThat(json.size()).isEqualTo(2); assertThat(json.get("code").asText()).isEqualTo(code); assertThat(json.get("message").asText()).isEqualTo(message);
        assertThat(snapshot(d.team().getId())).isEqualTo(before); verifyNoInteractions(verifier,storage);
    }
    /** 테스트 서버에 원본 multipart 바이트를 전송하며 실제 Azure에는 접근하지 않는다. */
    private HttpResponse<String> send(Data d,byte[] bytes,boolean includeBoundary) throws Exception {
        String boundary="cooperative-role-photo-boundary";
        var body=new ByteArrayOutputStream();
        body.write(("--"+boundary+"\r\nContent-Disposition: form-data; name=\"itemImage\"; filename=\"photo.png\"\r\nContent-Type: image/png\r\n\r\n").getBytes(StandardCharsets.US_ASCII));
        body.write(bytes); body.write(("\r\n--"+boundary+"--\r\n").getBytes(StandardCharsets.US_ASCII));
        String path="/api/v2/cooperative-missions/"+d.team().getId()+"/role-progresses/"+d.card().getId()+"/verification";
        var request=HttpRequest.newBuilder(URI.create("http://localhost:"+port+path)).timeout(Duration.ofSeconds(30))
                .header("Authorization","Bearer "+tokens.createAccessToken(d.user()).value())
                .header("Content-Type","multipart/form-data"+(includeBoundary ? "; boundary="+boundary : ""))
                .POST(HttpRequest.BodyPublishers.ofByteArray(body.toByteArray())).build();
        try(var client=HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).build()) {
            return client.send(request,HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        }
    }
}
