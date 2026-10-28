package com.jamkkanjeju.server.domain.guestbook.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.guestbook.entity.*;
import com.jamkkanjeju.server.domain.guestbook.support.GuestbookLikeIntegrationTestSupport;
import com.jamkkanjeju.server.domain.map.support.MapModalFixtures;
import com.jayway.jsonpath.JsonPath;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** 토글 HTTP 계약·실제 등록/삭제·대상 검증·사용자 격리와 실패 롤백을 검증한다. */
class ToggleGuestbookLikeApiIntegrationTest extends GuestbookLikeIntegrationTestSupport {
    @ParameterizedTest @CsvSource({"true,true", "true,false", "false,true", "false,false"})
    void 두유형과_본인타인_방명록을_등록_취소_재등록한다(boolean general, boolean own) throws Exception {
        Guestbook book = addBook(general, own ? current : other, GuestbookStatus.ACTIVE); reload();
        List<Object> before = unchangedState();
        String json = result(book.getId(), current, true, 1).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertThat((Map<String, Object>) JsonPath.read(json, "$")).containsOnlyKeys("guestbookId", "isLiked", "likeCount");
        assertThat(likeRows(book.getId())).hasSize(1).first().satisfies(row -> assertThat(row.get("user_id")).isEqualTo(current.getId()));
        result(book.getId(), current, false, 0); assertThat(likeCount(book.getId())).isZero();
        result(book.getId(), current, true, 1); assertThat(likeCount(book.getId())).isEqualTo(1);
        mvc.perform(get(URL).header("Authorization", bearer(current))).andExpect(status().isOk())
                .andExpect(jsonPath(general ? "$.generalGuestbooks[?(@.id == " + book.getId() + ")].isLiked" : "$.roadGuestbooks[?(@.id == " + book.getId() + ")].isLiked")
                        .value(org.hamcrest.Matchers.contains(true)))
                .andExpect(jsonPath(general ? "$.generalGuestbooks[?(@.id == " + book.getId() + ")].likeCount" : "$.roadGuestbooks[?(@.id == " + book.getId() + ")].likeCount")
                        .value(org.hamcrest.Matchers.contains(1)));
        assertThat(unchangedState()).isEqualTo(before); verifyNoInteractions(storage);
    }

    @Test void 다른사용자와_다른방명록의_좋아요를_유지한다() throws Exception {
        Guestbook target = addBook(false, other, GuestbookStatus.ACTIVE);
        Guestbook another = addBook(false, current, GuestbookStatus.ACTIVE);
        addLike(target, other); addLike(another, current); reload();
        List<Map<String, Object>> existing = likeRows(target.getId());
        List<Map<String, Object>> anotherRows = likeRows(another.getId());
        result(target.getId(), current, true, 2); result(target.getId(), current, false, 1);
        assertThat(likeRows(target.getId())).isEqualTo(existing);
        assertThat(likeRows(another.getId())).isEqualTo(anotherRows);
    }

    @ParameterizedTest @ValueSource(booleans = {false, true})
    void 작성자가_삭제되어도_활성방명록은_허용한다(boolean general) throws Exception {
        Guestbook book = addBook(general, other, GuestbookStatus.ACTIVE); reload();
        jdbc.update("delete from user where id=?", other.getId()); em.clear();
        if (general) { jdbc.update("update location_guestbook set visited_location_id=null where guestbook_id=?", book.getId()); em.clear(); }
        result(book.getId(), current, true, 1); result(book.getId(), current, false, 0);
        assertThat(jdbc.queryForObject("select user_id from guestbook where id=?", Long.class, book.getId())).isNull();
    }

    @Test void 없는방명록과_비활성은_정해진404이며_기존좋아요를_유지한다() throws Exception {
        Guestbook inactive = addBook(false, current, GuestbookStatus.INACTIVE); addLike(inactive, current); reload();
        List<Map<String, Object>> before = likeRows(inactive.getId());
        mvc.perform(toggle(Long.MAX_VALUE, current)).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("GUESTBOOK_NOT_FOUND")).andExpect(jsonPath("$.message").value("방명록을 찾을 수 없습니다."));
        mvc.perform(toggle(inactive.getId(), current)).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("GUESTBOOK_INACTIVE")).andExpect(jsonPath("$.message").value("비활성화된 방명록입니다."));
        assertThat(likeRows(inactive.getId())).isEqualTo(before);
    }

    @ParameterizedTest @ValueSource(strings = {"0", "-1", "0.5", "abc", "9223372036854775808"})
    void ID의_범위와_타입은_공통400이다(String id) throws Exception {
        mvc.perform(post(URL + "/{id}/like", id).header("Authorization", bearer(current))).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST")).andExpect(jsonPath("$.message").value("요청값이 올바르지 않습니다."));
    }

    @Test void 인증없이_변경할수없고_없는사용자도_거절한다() throws Exception {
        Guestbook book = addBook(false, current, GuestbookStatus.ACTIVE); reload();
        mvc.perform(post(URL + "/{id}/like", book.getId())).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
        mvc.perform(post(URL + "/{id}/like", book.getId()).header("Authorization", "Bearer invalid"))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("INVALID_TOKEN"));
        User missing = MapModalFixtures.user(Long.MAX_VALUE, "missing@example.com");
        mvc.perform(toggle(book.getId(), missing)).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
        assertThat(likeCount(book.getId())).isZero();
    }

    @Test @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void 실제커밋으로_등록과_취소를_반영한다() throws Exception {
        Long id = transactions.execute(tx -> addBook(false, current, GuestbookStatus.ACTIVE).getId());
        result(id, current, true, 1); assertThat(likeCount(id)).isEqualTo(1);
        result(id, current, false, 0); assertThat(likeCount(id)).isZero();
    }

    @ParameterizedTest @ValueSource(booleans = {false, true})
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void flush후_집계실패는_등록과_삭제를_모두_롤백한다(boolean existing) throws Exception {
        Long id = transactions.execute(tx -> {
            Guestbook book = addBook(false, current, GuestbookStatus.ACTIVE);
            if (existing) addLike(book, current);
            em.flush(); return book.getId();
        });
        List<Map<String, Object>> before = likeRows(id);
        doThrow(new IllegalStateException("테스트 집계 실패 원문")).when(likes).countByGuestbookId(id);
        mvc.perform(toggle(id, current)).andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.code").value("INTERNAL_SERVER_ERROR"))
                .andExpect(jsonPath("$.message").value("서버 내부 오류가 발생했습니다."));
        verify(likes).flush(); assertThat(likeRows(id)).isEqualTo(before); verifyNoInteractions(storage);
    }

    @Test void 스웨거의_토글은_본문없이_경로ID와_200응답을_노출한다() throws Exception {
        String json = mvc.perform(get("/v3/api-docs")).andExpect(status().isOk()).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        Map<String, Object> operation = JsonPath.read(json, "$.paths['/api/v2/guestbooks/{guestbookId}/like'].post");
        assertThat(operation).doesNotContainKey("requestBody");
        assertThat((Map<String, Object>) operation.get("responses")).containsKey("200");
        assertThat((Map<String, Object>) JsonPath.read(json, "$.components.schemas.ToggleGuestbookLikeResponse.properties"))
                .containsOnlyKeys("guestbookId", "isLiked", "likeCount");
        assertThat((Map<String, Object>) JsonPath.read(json, "$.paths['/api/v2/guestbooks']")).containsKeys("get", "post");
        assertThat((List<String>) JsonPath.read(json, "$.paths['/api/v2/guestbooks/{guestbookId}/like'].post.parameters[*].name"))
                .containsExactly("guestbookId");
    }
}
