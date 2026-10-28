package com.jamkkanjeju.server.domain.guestbook.dto;

import static com.jamkkanjeju.server.domain.guestbook.support.GuestbookFixtures.*;
import static com.jamkkanjeju.server.domain.map.support.MapModalFixtures.user;
import static com.jamkkanjeju.server.domain.map.support.MapModalFixtures.location;
import static com.jamkkanjeju.server.domain.map.support.MapModalFixtures.onboarding;
import static org.assertj.core.api.Assertions.assertThat;

import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.guestbook.dto.GetGuestbooksResponse.*;
import com.jamkkanjeju.server.domain.guestbook.entity.*;
import com.jamkkanjeju.server.domain.map.entity.VisitedLocation;
import com.jamkkanjeju.server.domain.mission.entity.*;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

/** 저장값·선택 연관관계의 응답 변환과 외부 목록 변경 격리를 검증한다. */
class GetGuestbooksResponseTest {
    @Test void 일반방명록은_프로필_장소_미션과_단일URL을_변환한다() {
        User author = user(1L, "response@example.com"); author.assignOnboardingResult(onboarding());
        Guestbook book = Guestbook.builder().id(101L).user(author).visitedAt(DATE)
                .savedAt(NOW).contentImgUrl("image.jpg").contentAudioUrl("audio.m4a").audioTitle("바다").build();
        Mission mission = Mission.builder().id(31L).missionType(MissionType.builder().type(MissionTypeCode.TREASURE).title("보물찾기").build()).build();
        GeneralGuestbookInfo result = GeneralGuestbookInfo.of(LocationGuestbook.builder().guestbook(book)
                .visitedLocation(VisitedLocation.builder().location(location(39L, 900L)).build()).mission(mission).build(), true, 2);
        assertThat(result.userId()).isEqualTo(1L);
        assertThat(result.characterImgUrl()).isEqualTo("https://example.com/profile.png");
        assertThat(result.location().id()).isEqualTo(39L);
        assertThat(result.mission()).isEqualTo(new MissionInfo(31L, "TREASURE", "보물찾기"));
        assertThat(result.contentImageUrl()).isEqualTo("image.jpg");
        assertThat(result.contentAudioUrl()).isEqualTo("audio.m4a");
        assertThat(result.audioTitle()).isEqualTo("바다");
        assertThat(result.savedAt()).isEqualTo(NOW);
        assertThat(result.isLiked()).isTrue(); assertThat(result.likeCount()).isEqualTo(2);
    }

    @Test void 작성자_온보딩_미션과_선택콘텐츠가_없으면_null을_유지한다() {
        Guestbook book = Guestbook.builder().id(102L).visitedAt(DATE).savedAt(NOW).build();
        RoadGuestbookInfo road = RoadGuestbookInfo.of(RoadGuestbook.builder().guestbook(book).locationAlias("바다")
                .latitude(33).longitude(126).build(), false, 0);
        assertThat(road.userId()).isNull(); assertThat(road.userNickname()).isNull();
        assertThat(road.characterImgUrl()).isNull(); assertThat(road.contentAudioUrl()).isNull();
        assertThat(road.audioTitle()).isNull(); assertThat(road.locationAlias()).isEqualTo("바다");
        book = Guestbook.builder().user(user(2L, "no-profile@example.com")).build();
        GeneralGuestbookInfo general = GeneralGuestbookInfo.of(LocationGuestbook.builder().guestbook(book)
                .visitedLocation(VisitedLocation.builder().location(location(39L, 900L)).build()).build(), false, 0);
        assertThat(general.characterImgUrl()).isNull(); assertThat(general.mission()).isNull();
    }

    @Test void 응답목록은_원본목록을_복사한다() {
        List<VisitedLocationInfo> visits = new ArrayList<>(List.of(new VisitedLocationInfo(39L, "장소")));
        GetGuestbooksResponse response = GetGuestbooksResponse.of(visits, List.of(), List.of(),
                GuestbooksPage.of(0, 10, false), GuestbooksPage.of(0, 10, false));
        visits.clear(); assertThat(response.visitedLocations()).hasSize(1);
    }

}
