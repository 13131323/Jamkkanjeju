package com.jamkkanjeju.server.domain.guestbook.service;

import static com.jamkkanjeju.server.domain.map.support.MapModalFixtures.user;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.jamkkanjeju.server.common.client.BlobStorageClient;
import com.jamkkanjeju.server.common.exception.CommonErrorCode;
import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.auth.repository.UserRepository;
import com.jamkkanjeju.server.domain.guestbook.dto.ToggleGuestbookLikeResponse;
import com.jamkkanjeju.server.domain.guestbook.entity.*;
import com.jamkkanjeju.server.domain.guestbook.exception.GuestbookErrorCode;
import com.jamkkanjeju.server.domain.guestbook.repository.*;
import com.jamkkanjeju.server.domain.map.repository.VisitedLocationRepository;
import com.jamkkanjeju.server.domain.mission.repository.MissionRepository;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;

/** 대상 검증과 잠금 이후 좋아요 등록·실제 삭제·집계 순서를 검증한다. */
@ExtendWith(MockitoExtension.class)
class ToggleGuestbookLikeServiceTest {
    @Mock UserRepository users;
    @Mock GuestbookRepository books;
    @Mock GuestbookLikeRepository likes;
    @Mock VisitedLocationRepository visits;
    @Mock MissionRepository missions;
    @Mock BlobStorageClient storage;
    @InjectMocks GuestbookService service;
    User current = user(15L, "like-unit@example.com");
    Guestbook book = Guestbook.builder().id(101L).status(GuestbookStatus.ACTIVE).build();
    GuestbookLikeId id = new GuestbookLikeId(101L, 15L);

    @BeforeEach void setup() { when(users.findById(15L)).thenReturn(Optional.of(current)); }

    @Test void 사용자없으면_방명록이나_좋아요를_조회하지않는다() {
        when(users.findById(15L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.toggleGuestbookLike(15L, 101L)).extracting("errorCode").isEqualTo(CommonErrorCode.UNAUTHORIZED);
        verifyNoInteractions(books, likes, visits, missions, storage);
    }

    @Test void 방명록없으면_잠금조회후_404를_던진다() {
        assertThatThrownBy(() -> service.toggleGuestbookLike(15L, 101L)).extracting("errorCode").isEqualTo(GuestbookErrorCode.GUESTBOOK_NOT_FOUND);
        verify(books).findByIdForUpdate(101L); verifyNoInteractions(likes, visits, missions, storage);
    }

    @Test void 비활성은_좋아요를_건드리지않는다() {
        when(books.findByIdForUpdate(101L)).thenReturn(Optional.of(Guestbook.builder().status(GuestbookStatus.INACTIVE).build()));
        assertThatThrownBy(() -> service.toggleGuestbookLike(15L, 101L)).extracting("errorCode").isEqualTo(GuestbookErrorCode.GUESTBOOK_INACTIVE);
        verifyNoInteractions(likes, visits, missions, storage);
    }

    @Test void 좋아요없으면_생성하고_flush후_집계한다() {
        when(books.findByIdForUpdate(101L)).thenReturn(Optional.of(book));
        when(likes.countByGuestbookId(101L)).thenReturn(3L);
        assertThat(service.toggleGuestbookLike(15L, 101L)).isEqualTo(ToggleGuestbookLikeResponse.of(101L, true, 3));
        ArgumentCaptor<GuestbookLike> saved = ArgumentCaptor.forClass(GuestbookLike.class);
        InOrder order = inOrder(users, books, likes);
        order.verify(users).findById(15L); order.verify(books).findByIdForUpdate(101L);
        order.verify(likes).findById(id); order.verify(likes).save(saved.capture());
        order.verify(likes).flush(); order.verify(likes).countByGuestbookId(101L);
        assertThat(saved.getValue().getId()).isEqualTo(id);
        assertThat(saved.getValue().getUser()).isSameAs(current);
        assertThat(saved.getValue().getGuestbook()).isSameAs(book);
        verify(likes, never()).delete(any()); verifyNoInteractions(visits, missions, storage);
    }

    @Test void 좋아요있으면_그행만_삭제하고_0도_반환한다() {
        GuestbookLike existing = GuestbookLike.builder().guestbook(book).user(current).build();
        when(books.findByIdForUpdate(101L)).thenReturn(Optional.of(book));
        when(likes.findById(id)).thenReturn(Optional.of(existing));
        assertThat(service.toggleGuestbookLike(15L, 101L)).isEqualTo(ToggleGuestbookLikeResponse.of(101L, false, 0));
        InOrder order = inOrder(books, likes);
        order.verify(books).findByIdForUpdate(101L); order.verify(likes).findById(id);
        order.verify(likes).delete(existing); order.verify(likes).flush(); order.verify(likes).countByGuestbookId(101L);
        verify(likes, never()).save(any()); verifyNoInteractions(visits, missions, storage);
    }

    @ParameterizedTest @ValueSource(booleans = {false, true})
    void 집계실패를_숨기거나_토글을_재시도하지않는다(boolean existing) {
        when(books.findByIdForUpdate(101L)).thenReturn(Optional.of(book));
        if (existing) when(likes.findById(id)).thenReturn(Optional.of(GuestbookLike.builder().guestbook(book).user(current).build()));
        when(likes.countByGuestbookId(101L)).thenThrow(new IllegalStateException("집계 실패"));
        assertThatThrownBy(() -> service.toggleGuestbookLike(15L, 101L)).isInstanceOf(IllegalStateException.class).hasMessage("집계 실패");
        verify(likes).findById(id); verify(likes).flush(); verify(likes).countByGuestbookId(101L);
        verifyNoInteractions(visits, missions, storage);
    }
}
