package com.jamkkanjeju.server.domain.treasurehunt.integration;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static com.jamkkanjeju.server.domain.treasurehunt.support.PictureFixtures.*;

import com.jamkkanjeju.server.domain.auth.config.JwtProperties;
import com.jamkkanjeju.server.domain.auth.jwt.JwtTokenProvider;
import com.jamkkanjeju.server.domain.auth.support.AuthFixtures;
import com.jamkkanjeju.server.domain.treasurehunt.entity.PictureWithCharacter;
import com.jamkkanjeju.server.domain.treasurehunt.repository.PictureWithCharacterRepository;
import com.jamkkanjeju.server.domain.treasurehunt.support.PictureIntegrationTestSupport;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import javax.crypto.SecretKey;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.*;
import org.springframework.transaction.annotation.*;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import tools.jackson.databind.json.JsonMapper;

/** 실제 JWT·MockMvc·MySQL로 사진 저장 계약·오류·격리와 파일 보상 삭제를 검증한다. */
@SpringBootTest(properties = {"app.blob-storage.container=test-media", "logging.level.org.hibernate.SQL=warn"})
@AutoConfigureMockMvc
@Import(PictureIntegrationTestSupport.FixedTime.class)
@Transactional
class SavePictureWithCharacterApiIntegrationTest extends PictureIntegrationTestSupport {
    @Autowired MockMvc mvc;
    @Autowired SecretKey jwtSigningKey;
    @Autowired JwtProperties jwtProperties;
    @MockitoSpyBean PictureWithCharacterRepository pictures;

    @ParameterizedTest
    @ValueSource(strings = {"JPEG", "PNG", "WEBP"})
    void 사진만_전송해_빈204와_서버시각을_저장하고_부수데이터를_유지한다(String format) throws Exception {
        Data d = data();
        reload();
        var before = snapshot(d);
        byte[] bytes = image(format);
        save(d, bytes).andExpect(status().isNoContent()).andExpect(content().string(""));
        reload();
        var rows = rows(d);
        assertThat(rows).hasSize(2);
        var saved = em.find(PictureWithCharacter.class, ((Number) rows.getLast().get("id")).longValue());
        assertThat(saved.getUser().getId()).isEqualTo(d.user().getId());
        assertThat(saved.getSavedAt()).isEqualTo(NOW);
        assertThat(saved.getId()).isNotEqualTo(d.oldId());
        String extension = format.equals("JPEG") ? ".jpg" : "." + format.toLowerCase();
        assertThat(saved.getPictureUrl()).startsWith("https://example.invalid/test-media/ar_character_picture/" + d.user().getId() + "/")
                .endsWith(extension).doesNotContain("untrusted");
        verify(storage).upload(eq(bytes), anyString(), eq("image/" + format.toLowerCase()));
        assertThat(snapshot(d)).isEqualTo(before);
    }

    @Test
    void 같은사진을_반복해도_새행과_서로다른_UUID로_저장한다() throws Exception {
        Data d = data();
        reload();
        var before = snapshot(d);
        save(d, image("PNG")).andExpect(status().isNoContent());
        save(d, image("PNG")).andExpect(status().isNoContent());
        reload();
        assertThat(rows(d)).hasSize(3);
        assertThat(rows(d)).extracting(row -> row.get("picture_url")).doesNotHaveDuplicates();
        assertThat(snapshot(d)).isEqualTo(before);
    }

    @Test
    void 파일누락과_빈파일은_공통400이고_저장하지_않는다() throws Exception {
        Data d = data();
        reload();
        error(mvc.perform(multipart(URL).header("Authorization", bearer(d.user()))), 400, "INVALID_REQUEST", "요청값이 올바르지 않습니다.");
        error(save(d, new byte[0]), 400, "INVALID_REQUEST", "요청값이 올바르지 않습니다.");
        assertThat(rows(d)).hasSize(1);
        verifyNoInteractions(storage);
    }

    @Test
    void 형식_용량_손상은_각각_개별400으로_거절한다() throws Exception {
        Data d = data();
        reload();
        var before = snapshot(d);
        error(save(d, "GIF89a".getBytes(StandardCharsets.US_ASCII)), 400, "INVALID_IMAGE_FORMAT", "지원하지 않는 이미지 형식입니다.");
        error(save(d, new byte[10_000_001]), 400, "IMAGE_SIZE_EXCEEDED", "이미지 파일은 10MB를 초과할 수 없습니다.");
        error(save(d, Arrays.copyOf(image("PNG"), 10)), 400, "INVALID_IMAGE", "손상되었거나 올바르지 않은 이미지 파일입니다.");
        assertThat(rows(d)).hasSize(1);
        assertThat(snapshot(d)).isEqualTo(before);
        verifyNoInteractions(storage);
    }

    @Test
    void 인증오류와_DB사용자없음은_401이다() throws Exception {
        Data d = data();
        reload();
        String token = tokens.createAccessToken(d.user()).value();
        String expired = new JwtTokenProvider(jwtSigningKey, jwtProperties, Clock.offset(CLOCK, Duration.ofHours(-1)))
                .createAccessToken(d.user()).value();
        for (String[] values : List.of(new String[]{null, "UNAUTHORIZED", "인증이 필요합니다."},
                new String[]{token + "x", "INVALID_TOKEN", "유효하지 않은 토큰입니다."},
                new String[]{expired, "EXPIRED_TOKEN", "만료된 토큰입니다."})) {
            var request = multipart(URL).file(picture(image("PNG")));
            if (values[0] != null) request.header("Authorization", "Bearer " + values[0]);
            error(mvc.perform(request), 401, values[1], values[2]);
        }
        error(mvc.perform(multipart(URL).file(picture(image("PNG")))
                        .header("Authorization", bearer(AuthFixtures.activeUser(Long.MAX_VALUE)))),
                401, "UNAUTHORIZED", "인증이 필요합니다.");
        assertThat(rows(d)).hasSize(1);
        verifyNoInteractions(storage);
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void 실제_커밋한_사진은_파일을_삭제하지_않는다() throws Exception {
        Data d = transactions.execute(status -> data());
        try {
            save(d, image("PNG")).andExpect(status().isNoContent());
            assertThat(rows(d)).hasSize(2);
            verify(storage, never()).delete(anyString());
        } finally {
            clean(d);
        }
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void 실제flush후_저장실패와_메서드반환후_커밋직전실패는_행과_파일을_정리한다(boolean commitFailure) throws Exception {
        Data d = transactions.execute(status -> data());
        try {
            var before = snapshot(d);
            doAnswer(invocation -> {
                PictureWithCharacter record = invocation.getArgument(0);
                em.persist(record); em.flush();
                assertThat(rows(d)).hasSize(2);
                if (!commitFailure) throw new IllegalStateException("내부 DB 저장 실패");
                TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                    @Override public void beforeCommit(boolean readOnly) { throw new IllegalStateException("내부 커밋 직전 실패"); }
                });
                return record;
            }).when(pictures).saveAndFlush(any());
            var result = error(save(d, image("PNG")), 500, "INTERNAL_SERVER_ERROR", "서버 내부 오류가 발생했습니다.");
            assertThat(result.andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8))
                    .doesNotContain("내부 DB", "커밋 직전");
            assertThat(rows(d)).hasSize(1);
            assertThat(snapshot(d)).isEqualTo(before);
            var name = ArgumentCaptor.forClass(String.class);
            verify(storage).upload(any(), name.capture(), eq("image/png"));
            verify(storage).delete(name.getValue());
        } finally {
            reset(pictures);
            clean(d);
        }
    }

    @Test
    void 업로드실패는_사진행을_만들거나_기존파일을_삭제하지_않는다() throws Exception {
        Data d = data();
        reload();
        when(storage.upload(any(), anyString(), anyString())).thenThrow(new IllegalStateException("외부 업로드 비밀 오류"));
        var result = error(save(d, image("PNG")), 500, "INTERNAL_SERVER_ERROR", "서버 내부 오류가 발생했습니다.");
        assertThat(result.andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8)).doesNotContain("비밀 오류");
        assertThat(rows(d)).hasSize(1);
        verify(storage, never()).delete(anyString());
    }

    @Test
    void Swagger는_multipart_파일하나와_204를_명시한다() throws Exception {
        String json = mvc.perform(get("/v3/api-docs")).andExpect(status().isOk()).andReturn().getResponse()
                .getContentAsString(StandardCharsets.UTF_8);
        var root = JsonMapper.builder().build().readTree(json);
        var operation = root.at("/paths/~1api~1v2~1treasure-missions~1pictures-with-character/post");
        assertThat(operation.at("/responses/204").isMissingNode()).isFalse();
        var schema = operation.at("/requestBody/content/multipart~1form-data/schema");
        assertThat(schema.isMissingNode()).isFalse();
        if (schema.has("$ref")) schema = root.at(schema.get("$ref").asText().substring(1));
        assertThat(schema.at("/properties/picture/format").asText()).isEqualTo("binary");
        assertThat(schema.at("/properties/takenAt").isMissingNode()).isTrue();
    }

    /** 사진만 포함한 실제 인증 multipart 요청이다. */
    private ResultActions save(Data d, byte[] bytes) throws Exception {
        return mvc.perform(multipart(URL).file(picture(bytes)).header("Authorization", bearer(d.user())));
    }

    /** 상태·코드·메시지가 명세와 정확히 일치하는지 검증한다. */
    private ResultActions error(ResultActions result, int code, String name, String message) throws Exception {
        return result.andExpect(status().is(code)).andExpect(jsonPath("$.code").value(name)).andExpect(jsonPath("$.message").value(message));
    }
}
