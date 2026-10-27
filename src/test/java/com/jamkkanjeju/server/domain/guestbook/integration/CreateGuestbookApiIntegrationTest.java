package com.jamkkanjeju.server.domain.guestbook.integration;

import static com.jamkkanjeju.server.domain.guestbook.support.GuestbookFixtures.*;
import static com.jamkkanjeju.server.domain.treasurehunt.support.PictureFixtures.image;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.nullValue;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.jamkkanjeju.server.domain.auth.support.AuthFixtures;
import com.jamkkanjeju.server.domain.cooperativemission.entity.*;
import com.jamkkanjeju.server.domain.culturemission.entity.*;
import com.jamkkanjeju.server.domain.guestbook.entity.Guestbook;
import com.jamkkanjeju.server.domain.guestbook.repository.GuestbookRepository;
import com.jamkkanjeju.server.domain.guestbook.support.GuestbookIntegrationTestSupport;
import com.jamkkanjeju.server.domain.mission.entity.*;
import com.jamkkanjeju.server.domain.treasurehunt.entity.*;
import com.jayway.jsonpath.JsonPath;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockMultipartHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/** 실제 multipart 바인딩·JWT·공유 PK·완료 이력·커밋과 파일 정리를 검증한다. */
@SpringBootTest(properties = {"app.blob-storage.container=media", "logging.level.org.hibernate.SQL=warn"})
@AutoConfigureMockMvc
@Transactional
@ExtendWith(OutputCaptureExtension.class)
class CreateGuestbookApiIntegrationTest extends GuestbookIntegrationTestSupport {
    @Autowired MockMvc mvc;
    @MockitoSpyBean GuestbookRepository books;

    private MockMultipartHttpServletRequestBuilder query(String type) {
        MockMultipartHttpServletRequestBuilder request = multipart(URL);
        request.param("guestbookType", type).param("visitedAt", DATE.toString()).header("Authorization", bearer(current));
        if (type.equals("GENERAL")) request.param("locationId", location.getId().toString());
        else request.param("locationAlias", "바다 앞").param("latitude", "33").param("longitude", "126");
        return request;
    }

    private ResultActions error(ResultActions result, int status, String code, String message) throws Exception {
        return result.andExpect(status().is(status)).andExpect(jsonPath("$.code").value(code)).andExpect(jsonPath("$.message").value(message));
    }

    private Long id(ResultActions result) throws Exception {
        String json = result.andExpect(status().isCreated()).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        return ((Number) JsonPath.read(json, "$.guestbookId")).longValue();
    }

    private Mission mission(MissionTypeCode type, MissionActivationStatus status) {
        MissionType missionType = em.createQuery("select t from MissionType t where t.type=:type", MissionType.class).setParameter("type", type).getSingleResult();
        Mission mission = persist(Mission.builder().missionType(missionType).build());
        switch (type) {
            case CULTURE -> persist(CultureMission.builder().mission(mission).status(status).build());
            case TREASURE -> persist(TreasureMission.builder().mission(mission).status(status).itemTotalCount(3).build());
            case COOPERATIVE -> persist(CooperativeMission.builder().mission(mission).status(status).build());
        }
        return mission;
    }

    private void completed(Mission mission, boolean own, ParticipantStatus participantStatus) {
        switch (mission.getMissionType().getType()) {
            case CULTURE -> persist(CultureMissionProgress.builder().cultureMission(em.find(CultureMission.class, mission.getId()))
                    .user(own ? current : other).missionStatus(MissionProgressStatus.COMPLETED).build());
            case TREASURE -> persist(TreasureMissionProgress.builder().treasureMission(em.find(TreasureMission.class, mission.getId()))
                    .user(own ? current : other).missionStatus(MissionProgressStatus.COMPLETED).completedAt(NOW).build());
            case COOPERATIVE -> {
                CooperativeMissionProgress progress = persist(CooperativeMissionProgress.builder()
                        .cooperativeMission(em.find(CooperativeMission.class, mission.getId())).missionStatus(MissionProgressStatus.COMPLETED)
                        .teamToken("book-team-" + mission.getId()).completedAt(NOW).build());
                persist(CooperativeMissionParticipant.builder().cooperativeMissionProgress(progress).user(own ? current : other)
                        .participantStatus(participantStatus).participantRole(ParticipantRole.MEMBER).joinedAt(NOW.minusHours(1)).build());
            }
        }
    }

    @ParameterizedTest @ValueSource(strings = {"GENERAL", "ROAD"})
    void 두파일과_사용자제목을_공유PK로_저장하고_반복해도_새로생성한다(String type) throws Exception {
        reload(); List<Object> before = snapshot();
        Long id = id(mvc.perform(query(type).file(file("imageFile", image("PNG"))).file(file("audioFile", audio("M4A")))
                .param("audioTitle", "가".repeat(20)).param("contentWriting", "기록").param("contentTemperatureCelsius", "24.5"))
                .andExpect(jsonPath("$.savedAt").value("2026-10-27T12:00:00")).andExpect(jsonPath("$.visitedAt").value(DATE.toString()))
                .andExpect(jsonPath("$.audioTitle").value("가".repeat(20))).andExpect(jsonPath("$.missionId").value(nullValue())));
        Map<String, Object> row = jdbc.queryForMap("select * from guestbook where id=?", id);
        assertThat(row.get("status")).isEqualTo("ACTIVE"); assertThat(row.get("audio_title")).isEqualTo("가".repeat(20));
        assertThat(row.get("content_img_url").toString()).contains("guestbook/" + type.toLowerCase() + "/" + id + "/images/").endsWith(".png");
        assertThat(row.get("content_audio_url").toString()).contains("/audios/").endsWith(".m4a");
        assertThat(jdbc.queryForObject("select count(*) from " + (type.equals("GENERAL") ? "location_guestbook" : "road_guestbook") + " where guestbook_id=?", Integer.class, id)).isEqualTo(1);
        Long second = id(mvc.perform(query(type).file(file("imageFile", image("PNG")))));
        assertThat(second).isNotEqualTo(id); assertThat(rows()).hasSize(2);
        assertThat(rows()).extracting(record -> record.get("content_img_url")).doesNotHaveDuplicates();
        assertThat(snapshot()).isEqualTo(before);
        verify(storage, times(2)).upload(eq(image("PNG")), anyString(), eq("image/png"));
        verify(storage).upload(eq(audio("M4A")), anyString(), eq("audio/mp4"));
    }

    @Test void 파일과_제목은_선택이며_필드키를_생략하지않는다() throws Exception {
        Long empty = id(mvc.perform(query("ROAD").param("audioTitle", "무시할 제목"))
                .andExpect(jsonPath("$.contentImageUrl").value(nullValue())).andExpect(jsonPath("$.contentAudioUrl").value(nullValue()))
                .andExpect(jsonPath("$.audioTitle").value(nullValue())).andExpect(jsonPath("$.locationId").value(nullValue())));
        assertThat(jdbc.queryForMap("select * from guestbook where id=?", empty).get("audio_title")).isNull();
        id(mvc.perform(query("ROAD").file(file("audioFile", audio("MP3")))).andExpect(jsonPath("$.audioTitle").value(nullValue())));
        verify(storage, times(1)).upload(any(), anyString(), anyString());
    }

    @ParameterizedTest @EnumSource(MissionTypeCode.class)
    void 본인완료는_연결하고_다른사용자완료는_연결하지않는다(MissionTypeCode type) throws Exception {
        Mission own = mission(type, MissionActivationStatus.ACTIVE); completed(own, true, ParticipantStatus.ACCEPTED);
        Mission others = mission(type, MissionActivationStatus.ACTIVE); completed(others, false, ParticipantStatus.ACCEPTED);
        Mission notCompleted = mission(type, MissionActivationStatus.ACTIVE);
        reload(); List<Object> before = snapshot();
        id(mvc.perform(query("GENERAL").param("missionId", own.getId().toString())).andExpect(jsonPath("$.missionId").value(own.getId())));
        id(mvc.perform(query("GENERAL").param("missionId", others.getId().toString())).andExpect(jsonPath("$.missionId").value(nullValue())));
        id(mvc.perform(query("GENERAL").param("missionId", notCompleted.getId().toString())).andExpect(jsonPath("$.missionId").value(nullValue())));
        assertThat(snapshot()).isEqualTo(before);
    }

    @Test void 협동_PENDING완료는_미연결이고_과거_ACCEPTED완료는_진행중팀이있어도_인정한다() throws Exception {
        Mission pending = mission(MissionTypeCode.COOPERATIVE, MissionActivationStatus.ACTIVE); completed(pending, true, ParticipantStatus.PENDING);
        Mission accepted = mission(MissionTypeCode.COOPERATIVE, MissionActivationStatus.ACTIVE); completed(accepted, true, ParticipantStatus.ACCEPTED);
        CooperativeMissionProgress progress = persist(CooperativeMissionProgress.builder().cooperativeMission(em.find(CooperativeMission.class, accepted.getId()))
                .missionStatus(MissionProgressStatus.IN_PROGRESS).teamToken("book-current-" + accepted.getId()).build());
        persist(CooperativeMissionParticipant.builder().cooperativeMissionProgress(progress).user(current)
                .participantStatus(ParticipantStatus.ACCEPTED).participantRole(ParticipantRole.HOST).joinedAt(NOW).build());
        reload();
        id(mvc.perform(query("GENERAL").param("missionId", pending.getId().toString())).andExpect(jsonPath("$.missionId").value(nullValue())));
        id(mvc.perform(query("GENERAL").param("missionId", accepted.getId().toString())).andExpect(jsonPath("$.missionId").value(accepted.getId())));
    }

    @ParameterizedTest @EnumSource(MissionTypeCode.class)
    void 비활성은_완료했어도_404이며_새행과_Blob이_없다(MissionTypeCode type) throws Exception {
        Mission mission = mission(type, MissionActivationStatus.INACTIVE); completed(mission, true, ParticipantStatus.ACCEPTED);
        reload(); List<Object> before = snapshot();
        error(mvc.perform(query("GENERAL").param("missionId", mission.getId().toString())), 404, "MISSION_INACTIVE", "비활성화된 미션입니다.");
        assertThat(rows()).isEmpty(); assertThat(snapshot()).isEqualTo(before); verifyNoInteractions(storage);
    }

    @Test void 방문격리와_장소_미션_상세없음_오류를_반환한다() throws Exception {
        reload();
        MockMultipartHttpServletRequestBuilder unvisited = query("GENERAL");
        unvisited.with(request -> { request.removeHeader("Authorization"); request.addHeader("Authorization", bearer(other)); return request; });
        error(mvc.perform(unvisited), 409, "LOCATION_NOT_VISITED", "방문한 장소에만 방명록을 작성할 수 있습니다.");
        error(mvc.perform(query("GENERAL").with(request -> { request.setParameter("locationId", Long.toString(Long.MAX_VALUE)); return request; })), 404, "LOCATION_NOT_FOUND", "장소를 찾을 수 없습니다.");
        error(mvc.perform(query("GENERAL").param("missionId", Long.toString(Long.MAX_VALUE))), 404, "MISSION_NOT_FOUND", "미션을 찾을 수 없습니다.");
        MissionType type = em.createQuery("select t from MissionType t where t.type=:type", MissionType.class).setParameter("type", MissionTypeCode.CULTURE).getSingleResult();
        Mission missingDetail = persist(Mission.builder().missionType(type).build()); reload();
        error(mvc.perform(query("GENERAL").param("missionId", missingDetail.getId().toString())), 404, "MISSION_NOT_FOUND", "미션을 찾을 수 없습니다.");
        assertThat(rows()).isEmpty(); verifyNoInteractions(storage);
    }

    @Test void 파일중복_빈파일_조건부필드와_일반검증은_공통400이다() throws Exception {
        for (String field : List.of("imageFile", "audioFile")) {
            error(mvc.perform(query("ROAD").file(file(field, audio("MP3"))).file(file(field, audio("MP3")))), 400, "INVALID_REQUEST", "요청값이 올바르지 않습니다.");
            error(mvc.perform(query("ROAD").file(file(field, new byte[0]))), 400, "INVALID_REQUEST", "요청값이 올바르지 않습니다.");
        }
        Map<String, String> invalid = Map.of("guestbookType", "OTHER", "visitedAt", "2026-02-30", "audioTitle", "가".repeat(21),
                "latitude", "NaN", "longitude", "181", "contentTemperatureCelsius", "1.23", "contentWriting", "가".repeat(501));
        for (Map.Entry<String, String> entry : invalid.entrySet()) {
            error(mvc.perform(query("ROAD").with(request -> { request.setParameter(entry.getKey(), entry.getValue()); return request; })), 400, "INVALID_REQUEST", "요청값이 올바르지 않습니다.");
        }
        error(mvc.perform(query("ROAD").param("missionId", "1")), 400, "INVALID_REQUEST", "요청값이 올바르지 않습니다.");
        error(mvc.perform(query("GENERAL").param("latitude", "33")), 400, "INVALID_REQUEST", "요청값이 올바르지 않습니다.");
        error(mvc.perform(query("GENERAL").with(request -> { request.removeParameter("locationId"); return request; })), 400, "INVALID_REQUEST", "요청값이 올바르지 않습니다.");
        assertThat(rows()).isEmpty(); verifyNoInteractions(storage);
    }

    @Test void 형식_손상_파일별용량은_명세의_개별400이다() throws Exception {
        error(mvc.perform(query("ROAD").file(file("imageFile", new byte[]{1, 2}))), 400, "INVALID_IMAGE_FORMAT", "지원하지 않는 이미지 형식입니다.");
        error(mvc.perform(query("ROAD").file(file("imageFile", Arrays.copyOf(image("PNG"), 10)))), 400, "INVALID_IMAGE", "손상되었거나 올바르지 않은 이미지 파일입니다.");
        error(mvc.perform(query("ROAD").file(file("imageFile", new byte[10_000_001]))), 400, "IMAGE_SIZE_EXCEEDED", "이미지 파일은 10MB를 초과할 수 없습니다.");
        error(mvc.perform(query("ROAD").file(file("audioFile", new byte[]{1, 2}))), 400, "INVALID_AUDIO_FORMAT", "지원하지 않는 오디오 형식입니다.");
        error(mvc.perform(query("ROAD").file(file("audioFile", new byte[10_000_001]))), 400, "AUDIO_SIZE_EXCEEDED", "오디오 파일은 10MB를 초과할 수 없습니다.");
        error(mvc.perform(query("ROAD").file(file("audioFile", wav(30.001, 0)))), 400, "AUDIO_DURATION_EXCEEDED", "오디오 재생 시간은 30초를 초과할 수 없습니다.");
        error(mvc.perform(query("ROAD").file(file("audioFile", Arrays.copyOf(audio("WAV"), 44)))), 400, "INVALID_AUDIO", "손상되었거나 올바르지 않은 오디오 파일입니다.");
        verifyNoInteractions(storage);
    }

    @Test void 인증실패는_저장없이_401이다() throws Exception {
        error(mvc.perform(multipart(URL).param("guestbookType", "ROAD")), 401, "UNAUTHORIZED", "인증이 필요합니다.");
        error(mvc.perform(multipart(URL).header("Authorization", "Bearer invalid")), 401, "INVALID_TOKEN", "유효하지 않은 토큰입니다.");
        error(mvc.perform(query("ROAD").with(request -> { request.removeHeader("Authorization"); request.addHeader("Authorization", bearer(AuthFixtures.activeUser(Long.MAX_VALUE))); return request; })), 401, "UNAUTHORIZED", "인증이 필요합니다.");
        assertThat(rows()).isEmpty(); verifyNoInteractions(storage);
    }

    @ParameterizedTest @ValueSource(strings = {"validation", "duration", "damage", "upload", "flush", "commit", "delete"})
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void 중간실패와_커밋실패는_새행과_성공한파일을_정리한다(String failure, CapturedOutput output) throws Exception {
        List<Object> before = snapshot();
        if (failure.equals("upload")) doThrow(new IllegalStateException("내부 업로드 실패")).when(storage).upload(any(), contains("/audios/"), anyString());
        if (failure.equals("delete")) doThrow(new IllegalStateException("내부 삭제 실패")).when(storage).delete(anyString());
        if (failure.equals("flush") || failure.equals("commit")) {
            AtomicBoolean injected = new AtomicBoolean();
            doAnswer(invocation -> {
                em.flush();
                if (injected.compareAndSet(false, true)) {
                    if (failure.equals("flush")) throw new IllegalStateException("내부 DB 실패");
                    TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                        @Override public void beforeCommit(boolean readOnly) { throw new IllegalStateException("내부 커밋 실패"); }
                    });
                }
                return null;
            }).when(books).flush();
        }
        boolean invalid = failure.equals("validation") || failure.equals("delete") || failure.equals("duration") || failure.equals("damage");
        byte[] submittedAudio = failure.equals("duration") ? wav(30.001, 0)
                : failure.equals("damage") ? Arrays.copyOf(audio("WAV"), 44)
                : invalid ? new byte[]{1, 2} : audio("MP3");
        ResultActions result = mvc.perform(query("ROAD").file(file("imageFile", image("PNG")))
                .file(file("audioFile", submittedAudio)));
        String code = failure.equals("duration") ? "AUDIO_DURATION_EXCEEDED" : failure.equals("damage") ? "INVALID_AUDIO"
                : invalid ? "INVALID_AUDIO_FORMAT" : "INTERNAL_SERVER_ERROR";
        String message = failure.equals("duration") ? "오디오 재생 시간은 30초를 초과할 수 없습니다."
                : failure.equals("damage") ? "손상되었거나 올바르지 않은 오디오 파일입니다."
                : invalid ? "지원하지 않는 오디오 형식입니다." : "서버 내부 오류가 발생했습니다.";
        error(result, invalid ? 400 : 500, code, message);
        assertThat(rows()).isEmpty(); assertThat(snapshot()).isEqualTo(before);
        ArgumentCaptor<String> names = ArgumentCaptor.forClass(String.class);
        verify(storage, times(failure.equals("flush") || failure.equals("commit") ? 2 : 1)).delete(names.capture());
        assertThat(names.getAllValues()).allSatisfy(name -> assertThat(name).startsWith("guestbook/road/").doesNotContain("untrusted"));
        if (failure.equals("delete")) assertThat(output.getOut()).contains("사진 롤백 파일 삭제 실패", "방명록 guestbookId=");
    }

    @Test @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void 실제성공커밋에서는_Blob을_삭제하지않는다() throws Exception {
        id(mvc.perform(query("GENERAL").file(file("imageFile", image("JPEG")))));
        assertThat(rows()).hasSize(1); verify(storage, never()).delete(anyString());
    }

    @Test void Swagger는_multipart와_201_제목길이만_공개한다() throws Exception {
        String json = mvc.perform(get("/v3/api-docs")).andExpect(status().isOk()).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertThat(json).contains("/api/v2/guestbooks", "multipart/form-data", "CreateGuestbookRequest");
        Map<String, Object> schema = JsonPath.read(json, "$.components.schemas.CreateGuestbookRequest.properties");
        assertThat(schema).containsKeys("imageFile", "audioFile", "audioTitle").doesNotContainKeys("validTypeFields", "validAttachments");
        assertThat((Number) JsonPath.read(json, "$.components.schemas.CreateGuestbookRequest.properties.audioTitle.maxLength")).isEqualTo(20);
        assertThat((Map<String, Object>) JsonPath.read(json, "$.paths['/api/v2/guestbooks'].post.responses")).containsKey("201");
    }
}
