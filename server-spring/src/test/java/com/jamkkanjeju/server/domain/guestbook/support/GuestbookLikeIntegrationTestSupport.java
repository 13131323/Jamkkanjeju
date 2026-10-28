package com.jamkkanjeju.server.domain.guestbook.support;

import static com.jamkkanjeju.server.domain.guestbook.support.GuestbookFixtures.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.guestbook.entity.*;
import com.jamkkanjeju.server.domain.guestbook.repository.GuestbookLikeRepository;
import com.jamkkanjeju.server.domain.guestbook.repository.GuestbookRepository;
import com.jamkkanjeju.server.domain.map.entity.VisitedLocation;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

/** 토글 API의 실제 JWT·임시 DB·고정 시각과 커밋/동시성 테스트 준비를 공유한다. */
@SpringBootTest(properties = {"app.blob-storage.container=media", "logging.level.org.hibernate.SQL=warn"})
@AutoConfigureMockMvc
@Transactional
public abstract class GuestbookLikeIntegrationTestSupport extends GuestbookIntegrationTestSupport {
    @Autowired protected MockMvc mvc;
    @MockitoSpyBean protected GuestbookLikeRepository likes;
    @MockitoSpyBean protected GuestbookRepository books;

    /** 테스트 트랜잭션에서 유형별 기록을 준비하며 ID는 DB가 생성한다. */
    protected Guestbook addBook(boolean general, User author, GuestbookStatus status) {
        Guestbook book = persist(Guestbook.builder().user(author).status(status).visitedAt(DATE).savedAt(NOW).contentWriting("원본 기록").build());
        if (general) {
            VisitedLocation visit = em.createQuery("select v from VisitedLocation v where v.user.id=:id and v.location.id=:locationId", VisitedLocation.class)
                    .setParameter("id", current.getId()).setParameter("locationId", location.getId()).getSingleResult();
            persist(LocationGuestbook.builder().guestbook(book).visitedLocation(visit).build());
        } else {
            persist(RoadGuestbook.builder().guestbook(book).locationAlias("바다 앞").latitude(33).longitude(126).build());
        }
        return book;
    }

    protected void addLike(Guestbook book, User user) { persist(GuestbookLike.builder().guestbook(book).user(user).build()); }
    protected MockHttpServletRequestBuilder toggle(Long id, User user) {
        return post(URL + "/{id}/like", id).header("Authorization", bearer(user));
    }
    protected ResultActions result(Long id, User user, boolean liked, long count) throws Exception {
        return mvc.perform(toggle(id, user)).andExpect(status().isOk()).andExpect(jsonPath("$.guestbookId").value(id))
                .andExpect(jsonPath("$.isLiked").value(liked)).andExpect(jsonPath("$.likeCount").value(count));
    }
    protected long likeCount(Long id) {
        return jdbc.queryForObject("select count(*) from guestbook_like where guestbook_id=?", Long.class, id);
    }
    protected List<Map<String, Object>> likeRows(Long id) {
        return jdbc.queryForList("select * from guestbook_like where guestbook_id=? order by user_id", id);
    }

    /** 좋아요 외 사용자·방문·미션·보상·방명록 원본 전체를 비교한다. */
    protected List<Object> unchangedState() {
        List<Object> state = new ArrayList<>(snapshot());
        for (String table : List.of("guestbook", "location_guestbook", "road_guestbook")) state.add(jdbc.queryForList("select * from " + table));
        return state;
    }
}
