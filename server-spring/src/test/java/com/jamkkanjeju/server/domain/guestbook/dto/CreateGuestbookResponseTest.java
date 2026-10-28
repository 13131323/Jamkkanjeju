package com.jamkkanjeju.server.domain.guestbook.dto;

import static com.jamkkanjeju.server.domain.guestbook.support.GuestbookFixtures.*;
import static org.assertj.core.api.Assertions.assertThat;

import com.jamkkanjeju.server.domain.guestbook.entity.*;
import com.jamkkanjeju.server.domain.map.entity.VisitedLocation;
import com.jamkkanjeju.server.domain.map.support.MapModalFixtures;
import com.jamkkanjeju.server.domain.map.support.MapLocationDetailFixtures;
import com.jamkkanjeju.server.domain.mission.entity.MissionTypeCode;
import org.junit.jupiter.api.Test;

/** 공통 기록과 유형별 위치를 응답으로 변환하고 오디오 없는 제목은 제거하는지 확인한다. */
class CreateGuestbookResponseTest {
    @Test
    void 일반방명록은_실제연결ID와_단일URL_날짜를_반환한다() {
        Guestbook common = Guestbook.builder().id(101L).visitedAt(DATE).savedAt(NOW).build();
        common.attachMedia("image.jpg", "audio.m4a", "사용자 제목");
        LocationGuestbook detail = LocationGuestbook.builder().guestbook(common)
                .visitedLocation(VisitedLocation.builder().location(MapModalFixtures.location(39L, 900L)).build())
                .mission(MapLocationDetailFixtures.mission(31L, MissionTypeCode.TREASURE)).build();
        CreateGuestbookResponse response = CreateGuestbookResponse.from(detail);
        assertThat(response.guestbookId()).isEqualTo(101L); assertThat(response.guestbookType()).isEqualTo("GENERAL");
        assertThat(response.locationId()).isEqualTo(39L); assertThat(response.missionId()).isEqualTo(31L);
        assertThat(response.latitude()).isNull(); assertThat(response.locationAlias()).isNull();
        assertThat(response.contentImageUrl()).isEqualTo("image.jpg"); assertThat(response.contentAudioUrl()).isEqualTo("audio.m4a");
        assertThat(response.audioTitle()).isEqualTo("사용자 제목"); assertThat(response.visitedAt()).isEqualTo(DATE); assertThat(response.savedAt()).isEqualTo(NOW);
    }

    @Test
    void 길바닥은_좌표만_반환하고_오디오없는_제목을_저장하지않는다() {
        Guestbook common = Guestbook.builder().id(102L).visitedAt(DATE).savedAt(NOW).build();
        common.attachMedia(null, null, "저장하지 않음");
        CreateGuestbookResponse response = CreateGuestbookResponse.from(RoadGuestbook.builder().guestbook(common)
                .locationAlias("바다").latitude(33).longitude(126).build());
        assertThat(response.guestbookType()).isEqualTo("ROAD"); assertThat(response.locationAlias()).isEqualTo("바다");
        assertThat(response.latitude()).isEqualTo(33); assertThat(response.longitude()).isEqualTo(126);
        assertThat(response.locationId()).isNull(); assertThat(response.missionId()).isNull();
        assertThat(response.contentImageUrl()).isNull(); assertThat(response.contentAudioUrl()).isNull(); assertThat(response.audioTitle()).isNull();
    }
}
