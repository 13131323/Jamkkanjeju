package com.jamkkanjeju.server.domain.mypage.integration;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.jamkkanjeju.server.common.client.*;
import com.jamkkanjeju.server.common.client.BlobStorageClient.UploadedBlob;
import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.auth.jwt.JwtTokenProvider;
import com.jamkkanjeju.server.domain.etc.repository.TravelEndingContentRepository;
import com.jamkkanjeju.server.support.MySqlIntegrationTestSupport;
import com.jayway.jsonpath.JsonPath;
import jakarta.persistence.EntityManager;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMultipartHttpServletRequestBuilder;
import org.springframework.transaction.support.*;

/** 외부만 모의 처리하고 실제 요청·DB 커밋·롤백·행 잠금 경쟁을 검증한다. */
@SpringBootTest
@AutoConfigureMockMvc
class CreateTravelEndingContentApiIntegrationTest extends MySqlIntegrationTestSupport {
    private static final String URL = "/api/v2/users/me/travel-ending-contents";
    private static final LocalDateTime NOW = LocalDateTime.of(2026, 11, 6, 12, 0);
    @Autowired MockMvc mvc;
    @Autowired EntityManager em;
    @Autowired JdbcTemplate jdbc;
    @Autowired TransactionTemplate transactions;
    @Autowired JwtTokenProvider tokens;
    @MockitoBean OpenAiClient ai;
    @MockitoBean BlobStorageClient storage;
    @MockitoBean TourApiClient tour;
    @MockitoBean ReferenceImageClient references;
    @MockitoBean Clock clock;
    @MockitoSpyBean TravelEndingContentRepository contents;
    private User user;
    private User other;
    private byte[] png;
    private String originalStatus;

    @BeforeEach
    void prepare() throws Exception {
        when(clock.instant()).thenReturn(NOW.atZone(ZoneId.of("Asia/Seoul")).toInstant());
        when(clock.getZone()).thenReturn(ZoneId.of("Asia/Seoul"));
        when(ai.isEnabled()).thenReturn(true);
        var output = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(1, 1, BufferedImage.TYPE_INT_RGB), "png", output);
        png = output.toByteArray();
        when(ai.editImage(anyString(), anyList())).thenAnswer(invocation -> {
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
            return png;
        });
        when(storage.upload(any(), anyString(), eq("image/png"))).thenAnswer(invocation ->
                new UploadedBlob(invocation.getArgument(1), "https://example.invalid/media/" + invocation.getArgument(1)));
        originalStatus = jdbc.queryForObject("select status from culture_mission where mission_id=1", String.class);
        transactions.execute(status -> {
            user = persistUser(200);
            other = persistUser(500);
            for (int id = 1; id <= 3; id++) {
                jdbc.update("insert into visited_location(user_id,location_id,last_visited_at) values(?,?,?)", user.getId(), id, NOW);
                jdbc.update("insert into culture_mission_progress(culture_mission_id,user_id,mission_status,current_quiz_index,correct_count,last_completed_at) values(?,?,'COMPLETED',3,1,?)", id, user.getId(), NOW);
            }
            return null;
        });
    }

    @AfterEach
    void clean() {
        if (originalStatus != null) jdbc.update("update culture_mission set status=? where mission_id=1", originalStatus);
        if (user != null) jdbc.update("delete from user where id=?", user.getId());
        if (other != null) jdbc.update("delete from user where id=?", other.getId());
    }

    @Test
    void 성공은201과실제저장값이며_반복요청은매번생성하고100포인트씩차감한다() throws Exception {
        var before = protectedState();
        var first = created(request("[1]", "[1]", 1).param("travelNote", " 여행 한 줄 "));
        var second = created(request("[1]", "[1]", 1));
        assertThat(first).containsEntry("remainingPoint", 100);
        assertThat(second).containsEntry("remainingPoint", 0);
        assertThat(first.get("id")).isNotEqualTo(second.get("id"));
        assertThat(first.get("imageUrl")).isNotEqualTo(second.get("imageUrl"));
        assertThat(point()).isZero();
        assertThat(rows()).hasSize(2);
        for (var row : rows()) {
            assertThat(jdbc.queryForObject("select saved_at from travel_ending_content where id=?",
                    LocalDateTime.class, row.get("id"))).isEqualTo(NOW);
            assertThat(row.get("image_url").toString()).contains("travel-ending/" + user.getId() + "/").endsWith(".png");
        }
        assertThat(protectedState()).isEqualTo(before);
        verify(ai, times(2)).editImage(anyString(), anyList());
        verify(storage, never()).delete(anyString());
    }

    @Test
    void 최대3개씩과사진3장을받아_요청순서와여행한줄을전달한다() throws Exception {
        created(request("[3,2,1]", "[3,2,1]", 3).param("travelNote", " {manifest_json} $1 "));
        var prompt = ArgumentCaptor.forClass(String.class);
        verify(ai).editImage(prompt.capture(), argThat(images -> images.size() == 3));
        String text = prompt.getValue();
        assertThat(text).contains("<travel_note>\n{manifest_json} $1\n</travel_note>");
        String manifest = text.substring(text.lastIndexOf("<manifest>") + 10, text.lastIndexOf("</manifest>"));
        assertThat(JsonPath.<String>read(manifest, "$[0].displayName")).isEqualTo(
                jdbc.queryForObject("select title from location where id=3", String.class));
        assertThat(JsonPath.<List<?>>read(manifest, "$[*]")).hasSize(9);
        assertThat(JsonPath.<Integer>read(manifest, "$[6].inputImageIndex")).isEqualTo(1);
        assertThat(JsonPath.<Integer>read(manifest, "$[8].inputImageIndex")).isEqualTo(3);
        assertThat(rows()).hasSize(1);
    }

    @Test
    void 비활성은503이며검증외부호출저장차감을하지않는다() throws Exception {
        when(ai.isEnabled()).thenReturn(false);
        error(request("[]", "[]", 0), 503, "TRAVEL_ENDING_DISABLED", "기능이 활성화되지 않았습니다.");
        unchanged();
        verify(ai, never()).editImage(anyString(), anyList());
        verifyNoInteractions(storage, tour, references);
    }

    @Test
    void 잔액99는생성전거절하고100은성공한다() throws Exception {
        jdbc.update("update user set point=99 where id=?", user.getId());
        error(request("[1]", "[1]", 1), 409, "INSUFFICIENT_POINT", "엽서 생성에 필요한 포인트가 부족합니다.");
        verify(ai, never()).editImage(anyString(), anyList());
        verifyNoInteractions(storage, tour, references);
        jdbc.update("update user set point=100 where id=?", user.getId());
        assertThat(created(request("[1]", "[1]", 1)).get("remainingPoint")).isEqualTo(0);
        assertThat(point()).isZero();
    }

    @Test
    void 생성중잔액이줄면잠금재검사에서실패하고업로드하지않는다() throws Exception {
        when(ai.editImage(anyString(), anyList())).thenAnswer(invocation -> {
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
            jdbc.update("update user set point=50 where id=?", user.getId());
            return png;
        });
        error(request("[1]", "[1]", 1), 409, "INSUFFICIENT_POINT", "엽서 생성에 필요한 포인트가 부족합니다.");
        assertThat(point()).isEqualTo(50);
        assertThat(rows()).isEmpty();
        verifyNoInteractions(storage);
    }

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {"[]|[1]|TRAVEL_ENDING_SELECTION_TOO_FEW", "[1]|[]|TRAVEL_ENDING_SELECTION_TOO_FEW",
            "[1,2,3,4]|[1]|TRAVEL_ENDING_SELECTION_TOO_MANY", "[1]|[1,2,3,4]|TRAVEL_ENDING_SELECTION_TOO_MANY"})
    void 최소최대선택오류를구분한다(String locations, String missions, String code) throws Exception {
        error(request(locations, missions, 1), 400, code, code.endsWith("FEW")
                ? "방문한 곳과 미션은 각각 최소 1개씩 선택해야 합니다." : "방문한 곳과 미션은 각각 최대 3개 선택할 수 있습니다.");
        unchanged();
        verify(ai, never()).editImage(anyString(), anyList());
        verifyNoInteractions(storage);
    }

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {"[4]|[1]", "[1]|[4]", "[1,1]|[1]", "broken|[1]", "[1]|[0]"})
    void 본인대상이아닌선택과잘못된입력은공통400이다(String locations, String missions) throws Exception {
        error(request(locations, missions, 1), 400, "INVALID_REQUEST", "요청값이 올바르지 않습니다.");
        unchanged();
        verify(ai, never()).editImage(anyString(), anyList());
        verifyNoInteractions(storage);
    }

    @Test
    void 비활성미션과사진개수위반은생성하지않는다() throws Exception {
        jdbc.update("update culture_mission set status='INACTIVE' where mission_id=1");
        error(request("[1]", "[1]", 1), 400, "INVALID_REQUEST", "요청값이 올바르지 않습니다.");
        error(request("[1]", "[2]", 0), 400, "INVALID_REQUEST", "요청값이 올바르지 않습니다.");
        error(request("[1]", "[2]", 4), 400, "INVALID_REQUEST", "요청값이 올바르지 않습니다.");
        unchanged();
        verify(ai, never()).editImage(anyString(), anyList());
    }

    @ParameterizedTest
    @ValueSource(strings = {"INVALID_IMAGE_FORMAT", "IMAGE_SIZE_EXCEEDED", "INVALID_IMAGE"})
    void 이미지검증오류를그대로반환한다(String code) throws Exception {
        byte[] data = switch (code) {
            case "IMAGE_SIZE_EXCEEDED" -> new byte[10_000_001];
            case "INVALID_IMAGE" -> new byte[]{(byte) 137, 80, 78, 71, 13, 10, 26, 10};
            default -> new byte[]{1, 2, 3};
        };
        String message = switch (code) {
            case "IMAGE_SIZE_EXCEEDED" -> "이미지 파일은 10MB를 초과할 수 없습니다.";
            case "INVALID_IMAGE" -> "손상되었거나 올바르지 않은 이미지 파일입니다.";
            default -> "지원하지 않는 이미지 형식입니다.";
        };
        error(request("[1]", "[1]", 0).file(new MockMultipartFile("photos", "photo.png", "image/png", data)), 400, code, message);
        unchanged();
        verify(ai, never()).editImage(anyString(), anyList());
    }

    @Test
    void AI실패와Blob실패는공통500이며기존상태를유지한다() throws Exception {
        when(ai.editImage(anyString(), anyList())).thenThrow(new IllegalStateException("AI failure"));
        error(request("[1]", "[1]", 1), 500, "INTERNAL_SERVER_ERROR", "서버 내부 오류가 발생했습니다.");
        unchanged();
        verifyNoInteractions(storage);
        doReturn(png).when(ai).editImage(anyString(), anyList());
        when(storage.upload(any(), anyString(), anyString())).thenThrow(new IllegalStateException("Blob failure"));
        error(request("[1]", "[1]", 1), 500, "INTERNAL_SERVER_ERROR", "서버 내부 오류가 발생했습니다.");
        unchanged();
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void DB저장또는커밋실패는차감을롤백하고이번Blob을삭제한다(boolean commitFailure) throws Exception {
        var commitReached = new java.util.concurrent.atomic.AtomicBoolean();
        if (!commitFailure) {
            doThrow(new DataIntegrityViolationException("forced save failure")).when(contents).saveAndFlush(any());
        } else {
            doAnswer(invocation -> {
                // Spring Data 인터페이스 spy의 추상 메서드를 직접 호출하지 않고 실제 JPA로 flush한다.
                var result = invocation.<com.jamkkanjeju.server.domain.etc.entity.TravelEndingContent>getArgument(0);
                em.persist(result);
                em.flush();
                TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                    @Override public void beforeCommit(boolean readOnly) {
                        commitReached.set(true);
                        throw new IllegalStateException("forced commit failure");
                    }
                });
                return result;
            }).when(contents).saveAndFlush(any());
        }
        error(request("[1]", "[1]", 1), 500, "INTERNAL_SERVER_ERROR", "서버 내부 오류가 발생했습니다.");
        assertThat(commitReached.get()).isEqualTo(commitFailure);
        unchanged();
        var name = ArgumentCaptor.forClass(String.class);
        verify(storage).upload(any(), name.capture(), eq("image/png"));
        verify(storage).delete(name.getValue());
    }

    @Test
    void 잔액100의동시두요청은한건만저장하고차감한다() throws Exception {
        jdbc.update("update user set point=100 where id=?", user.getId());
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch release = new CountDownLatch(1);
        when(ai.editImage(anyString(), anyList())).thenAnswer(invocation -> {
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
            ready.countDown();
            if (!release.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("barrier timeout");
            return png;
        });
        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(() -> mvc.perform(request("[1]", "[1]", 1)).andReturn().getResponse());
            var second = executor.submit(() -> mvc.perform(request("[1]", "[1]", 1)).andReturn().getResponse());
            try { assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue(); }
            finally { release.countDown(); }
            var responses = List.of(first.get(20, TimeUnit.SECONDS), second.get(20, TimeUnit.SECONDS));
            assertThat(responses).extracting(response -> response.getStatus()).containsExactlyInAnyOrder(201, 409);
            var failed = responses.stream().filter(response -> response.getStatus() == 409).findFirst().orElseThrow();
            assertThat(JsonPath.<String>read(failed.getContentAsString(StandardCharsets.UTF_8), "$.code")).isEqualTo("INSUFFICIENT_POINT");
        }
        assertThat(point()).isZero();
        assertThat(rows()).hasSize(1);
        verify(storage).upload(any(), anyString(), eq("image/png"));
    }

    @Test
    void 인증누락과잘못된토큰은공통401이다() throws Exception {
        mvc.perform(multipart(URL)).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
        mvc.perform(multipart(URL).header("Authorization", "Bearer invalid"))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("INVALID_TOKEN"));
        unchanged();
        verify(ai, never()).editImage(anyString(), anyList());
    }

    @Test
    void 스웨거는multipart요청과201응답을문서화한다() throws Exception {
        mvc.perform(get("/v3/api-docs")).andExpect(status().isOk())
                .andExpect(jsonPath("$.paths['" + URL + "'].post.requestBody.content['multipart/form-data']").exists())
                .andExpect(jsonPath("$.paths['" + URL + "'].post.responses['201']").exists())
                .andExpect(jsonPath("$.components.schemas.CreateTravelEndingContentResponse.properties.remainingPoint").exists());
    }

    private User persistUser(int point) {
        User created = User.builder().email(UUID.randomUUID() + "@example.com").passwordHash("test").point(point).build();
        em.persist(created); em.flush(); return created;
    }

    private MockMultipartHttpServletRequestBuilder request(String locations, String missions, int photos) {
        var request = multipart(URL).header("Authorization", "Bearer " + tokens.createAccessToken(user).value())
                .param("visitedLocationIds", locations).param("missionIds", missions);
        for (int index = 0; index < photos; index++) request.file(new MockMultipartFile("photos", "photo.png", "image/png", png));
        return request;
    }

    private Map<String, Object> created(MockMultipartHttpServletRequestBuilder request) throws Exception {
        String body = mvc.perform(request).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        Map<String, Object> result = JsonPath.read(body, "$");
        assertThat(result).containsOnlyKeys("id", "imageUrl", "remainingPoint");
        return result;
    }

    private void error(MockMultipartHttpServletRequestBuilder request, int statusCode, String code, String message) throws Exception {
        mvc.perform(request).andExpect(status().is(statusCode)).andExpect(jsonPath("$.code").value(code))
                .andExpect(jsonPath("$.message").value(message));
    }

    private int point() { return jdbc.queryForObject("select point from user where id=?", Integer.class, user.getId()); }
    private List<Map<String, Object>> rows() { return jdbc.queryForList("select * from travel_ending_content where user_id=? order by id", user.getId()); }
    private void unchanged() { assertThat(point()).isEqualTo(200); assertThat(rows()).isEmpty(); }

    private Map<String, Object> protectedState() {
        Map<String, Object> state = new LinkedHashMap<>();
        state.put("user", jdbc.queryForMap("select guestbook_last_checked_at,target_step,nickname from user where id=?", user.getId()));
        state.put("other", jdbc.queryForMap("select * from user where id=?", other.getId()));
        for (String table : List.of("visited_location", "culture_mission_progress", "mission_reward_status", "acquired_coupon", "acquired_ar_character")) {
            state.put(table, jdbc.queryForList("select * from " + table + " where user_id=?", user.getId()));
        }
        return state;
    }
}
