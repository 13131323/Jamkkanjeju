package com.jamkkanjeju.server.domain.guestbook.service;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.jamkkanjeju.server.common.client.BlobStorageClient;
import com.jamkkanjeju.server.common.exception.CommonErrorCode;
import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.auth.repository.UserRepository;
import com.jamkkanjeju.server.domain.guestbook.dto.*;
import com.jamkkanjeju.server.domain.guestbook.entity.*;
import com.jamkkanjeju.server.domain.guestbook.repository.*;
import com.jamkkanjeju.server.domain.guestbook.repository.GuestbookLikeRepository.LikeCount;
import com.jamkkanjeju.server.domain.map.entity.VisitedLocation;
import com.jamkkanjeju.server.domain.map.repository.VisitedLocationRepository;
import com.jamkkanjeju.server.domain.map.support.MapModalFixtures;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.SliceImpl;
import org.springframework.test.util.ReflectionTestUtils;

/** 독립 페이지 전달·좋아요 일괄 조회와 빈 결과·인증 실패 분기를 검증한다. */
@ExtendWith(MockitoExtension.class)
class GetGuestbooksServiceTest {
    @Mock UserRepository users;
    @Mock VisitedLocationRepository visits;
    @Mock LocationGuestbookRepository general;
    @Mock RoadGuestbookRepository road;
    @Mock GuestbookLikeRepository likes;
    @Mock GuestbookRepository books;
    @Mock BlobStorageClient storage;
    @Spy Clock clock = Clock.fixed(Instant.parse("2026-10-28T03:00:00Z"), ZoneId.of("Asia/Seoul"));
    @InjectMocks GuestbookService service;

    private void user() { when(users.findById(15L)).thenReturn(Optional.of(User.builder().build())); }

    @Test void 사용자없으면_후속조회하지않는다() {
        assertThatThrownBy(() -> service.getGuestbooks(15L, new GetGuestbooksRequest(null, null, null, null)))
                .extracting("errorCode").isEqualTo(CommonErrorCode.UNAUTHORIZED);
        verifyNoInteractions(visits, general, road, likes, books, storage);
    }

    @Test void 독립페이지와_실제반환ID만_전달하고_없는집계는_0이다() {
        user();
        LocationGuestbook g = LocationGuestbook.builder().guestbook(Guestbook.builder().id(101L).build())
                .visitedLocation(VisitedLocation.builder().location(MapModalFixtures.location(39L, 900L)).build()).build();
        ReflectionTestUtils.setField(g, "guestbookId", 101L);
        RoadGuestbook r = RoadGuestbook.builder().guestbook(Guestbook.builder().id(102L).build()).locationAlias("길").build();
        ReflectionTestUtils.setField(r, "guestbookId", 102L);
        when(general.findSliceByStatus(GuestbookStatus.ACTIVE, PageRequest.of(2, 1)))
                .thenReturn(new SliceImpl<>(List.of(g), PageRequest.of(2, 1), true));
        when(road.findSliceByStatus(GuestbookStatus.ACTIVE, PageRequest.of(3, 2)))
                .thenReturn(new SliceImpl<>(List.of(r), PageRequest.of(3, 2), false));
        when(likes.findGuestbookIdsByUserIdAndGuestbookIds(15L, List.of(101L, 102L))).thenReturn(List.of(102L));
        LikeCount count = mock(LikeCount.class);
        when(count.getGuestbookId()).thenReturn(102L); when(count.getLikeCount()).thenReturn(3L);
        when(likes.countByGuestbookIds(List.of(101L, 102L))).thenReturn(List.of(count));
        GetGuestbooksResponse response = service.getGuestbooks(15L, new GetGuestbooksRequest(2, 1, 3, 2));
        assertThat(response.generalGuestbooks().getFirst().likeCount()).isZero();
        assertThat(response.generalGuestbooks().getFirst().isLiked()).isFalse();
        assertThat(response.roadGuestbooks().getFirst().likeCount()).isEqualTo(3);
        assertThat(response.roadGuestbooks().getFirst().isLiked()).isTrue();
        assertThat(response.generalGuestbooksPage()).isEqualTo(new GetGuestbooksResponse.GuestbooksPage(2, 1, true));
        assertThat(response.roadGuestbooksPage()).isEqualTo(new GetGuestbooksResponse.GuestbooksPage(3, 2, false));
        assertThat(users.findById(15L).orElseThrow().getGuestbookLastCheckedAt()).isEqualTo(LocalDateTime.of(2026, 10, 28, 12, 0));
        verify(likes).countByGuestbookIds(List.of(101L, 102L)); verifyNoInteractions(books, storage);
    }

    @Test void 두목록이_비면_좋아요조회를_생략하고_방문장소를_유지한다() {
        user();
        when(visits.findAllByUserId(15L)).thenReturn(List.of(VisitedLocation.builder().location(MapModalFixtures.location(39L, 900L)).build()));
        when(general.findSliceByStatus(GuestbookStatus.ACTIVE, PageRequest.of(0, 10))).thenReturn(new SliceImpl<>(List.of()));
        when(road.findSliceByStatus(GuestbookStatus.ACTIVE, PageRequest.of(0, 10))).thenReturn(new SliceImpl<>(List.of()));
        GetGuestbooksResponse response = service.getGuestbooks(15L, new GetGuestbooksRequest(null, null, null, null));
        assertThat(response.visitedLocations()).extracting("id").containsExactly(39L);
        assertThat(response.generalGuestbooks()).isEmpty(); assertThat(response.roadGuestbooks()).isEmpty();
        assertThat(response.generalGuestbooksPage().size()).isEqualTo(10);
        verifyNoInteractions(likes, books, storage);
    }

    @Test void 일반만_비어도_길바닥_좋아요와_페이지는_유지한다() {
        user();
        RoadGuestbook r = RoadGuestbook.builder().guestbook(Guestbook.builder().id(103L).build()).build();
        ReflectionTestUtils.setField(r, "guestbookId", 103L);
        when(general.findSliceByStatus(GuestbookStatus.ACTIVE, PageRequest.of(0, 10))).thenReturn(new SliceImpl<>(List.of()));
        when(road.findSliceByStatus(GuestbookStatus.ACTIVE, PageRequest.of(0, 10))).thenReturn(new SliceImpl<>(List.of(r)));
        GetGuestbooksResponse response = service.getGuestbooks(15L, new GetGuestbooksRequest(null, null, null, null));
        assertThat(response.generalGuestbooks()).isEmpty(); assertThat(response.roadGuestbooks()).hasSize(1);
        verify(likes).findGuestbookIdsByUserIdAndGuestbookIds(15L, List.of(103L));
        verify(likes).countByGuestbookIds(List.of(103L)); verifyNoInteractions(books, storage);
    }
}
