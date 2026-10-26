package com.jamkkanjeju.server.domain.map.dto;

import static com.jamkkanjeju.server.domain.map.support.MapLocationDetailFixtures.*;
import static org.assertj.core.api.Assertions.assertThat;

import com.jamkkanjeju.server.domain.map.dto.GetLocationMapModalResponse.RewardDetail;
import com.jamkkanjeju.server.domain.map.dto.GetMapLocationDetailResponse.*;
import com.jamkkanjeju.server.domain.mission.entity.MissionTypeCode;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

/** 상세 응답의 설명·추천·페이징과 목록 복사·이미지 null 변환을 검증한다. */
class GetMapLocationDetailResponseTest {
    @Test
    void 계산된_값과_미션정보를_응답에_붙이고_목록은_복사한다() {
        MissionInfo mission = MissionInfo.of(mission(31L, MissionTypeCode.TREASURE), true,
                new RewardDetail(null, null, null));
        NearbyMissionInfo nearby = NearbyMissionInfo.of(mission, locationAt(40L, 1), "대표.jpg");
        List<String> images = new ArrayList<>(List.of("상세1.jpg", "상세2.jpg"));
        List<NearbyMissionInfo> recommendations = new ArrayList<>(List.of(nearby));
        GetMapLocationDetailResponse response = GetMapLocationDetailResponse.of(locationAt(39L, 0), 1200, 16,
                true, "장소 설명", images, recommendations, List.of(), GuestbooksPage.of(2, 20, true), mission);
        images.clear(); recommendations.clear();
        assertThat(response.locationTitle()).isEqualTo("장소39");
        assertThat(response.locationCategory()).isEqualTo("관광지");
        assertThat(response.locationAddress()).isEqualTo("제주 주소");
        assertThat(response.distanceMeter()).isEqualTo(1200);
        assertThat(response.durationMinutes()).isEqualTo(16);
        assertThat(response.isVisited()).isTrue();
        assertThat(response.locationDescription()).isEqualTo("장소 설명");
        assertThat(response.locationImageUrls()).containsExactly("상세1.jpg", "상세2.jpg");
        assertThat(response.nearbyMissions()).containsExactly(nearby);
        assertThat(nearby.locationTitle()).isEqualTo("장소40");
        assertThat(nearby.missionId()).isEqualTo(31L);
        assertThat(nearby.description()).isEqualTo("미션 설명");
        assertThat(nearby.representativeImageUrl()).isEqualTo("대표.jpg");
        assertThat(response.locationMission()).isEqualTo(mission);
        assertThat(response.guestbooksPage()).isEqualTo(new GuestbooksPage(2, 20, true));
    }

    @Test
    void 이미지_없음은_null_추천과_방명록_없음은_빈목록이다() {
        for (List<String> images : java.util.Arrays.asList(null, List.<String>of())) {
            GetMapLocationDetailResponse response = GetMapLocationDetailResponse.of(locationAt(39L, 0), 0, 0,
                    false, null, images, List.of(), List.of(), GuestbooksPage.of(0, 20, false), null);
            assertThat(response.locationImageUrls()).isNull();
            assertThat(response.locationDescription()).isNull();
            assertThat(response.nearbyMissions()).isEmpty();
            assertThat(response.guestbooks()).isEmpty();
            assertThat(response.locationMission()).isNull();
        }
    }
}
