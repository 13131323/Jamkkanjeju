package com.jamkkanjeju.server.domain.map.dto;

import static com.jamkkanjeju.server.domain.map.support.MapLocationDetailFixtures.*;
import static org.assertj.core.api.Assertions.assertThat;

import com.jamkkanjeju.server.domain.map.dto.GetMapSearchResponse.*;
import com.jamkkanjeju.server.domain.mission.entity.MissionTypeCode;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.Test;

/** 검색 응답의 값 변환·목록 복사와 계약에 포함된 공개 필드를 검증한다. */
class GetMapSearchResponseTest {
    @Test
    void 미션과_계산된거리_페이지를_붙이고_목록을_복사한다() {
        MissionInfo mission = MissionInfo.from(mission(31L, MissionTypeCode.TREASURE));
        LocationInfo location = LocationInfo.of(locationAt(39L, 1), "대표.jpg", 1200, mission);
        List<LocationInfo> items = new ArrayList<>(List.of(location));
        GetMapSearchResponse response = GetMapSearchResponse.of(items, LocationsPage.of(2, 20, true));
        items.clear();
        assertThat(response.locations()).containsExactly(location);
        assertThat(location.locationId()).isEqualTo(39L);
        assertThat(location.locationTitle()).isEqualTo("장소39");
        assertThat(location.locationCategory()).isEqualTo("관광지");
        assertThat(location.representativeImageUrl()).isEqualTo("대표.jpg");
        assertThat(location.distanceMeter()).isEqualTo(1200);
        assertThat(mission.missionId()).isEqualTo(31L);
        assertThat(mission.missionType()).isEqualTo("TREASURE");
        assertThat(mission.missionTitle()).isEqualTo(mission(31L, MissionTypeCode.TREASURE).getMissionType().getTitle());
        assertThat(response.locationsPage()).isEqualTo(new LocationsPage(2, 20, true));
    }

    @Test
    void 빈목록과_nullable을_유지하고_불필요한_계산정보를_추가하지_않는다() {
        LocationInfo location = LocationInfo.of(locationAt(39L, 0), null, 0, null);
        assertThat(location.mission()).isNull();
        assertThat(location.representativeImageUrl()).isNull();
        assertThat(GetMapSearchResponse.of(List.of(), LocationsPage.of(0, 20, false)).locations()).isEmpty();
        assertThat(Arrays.stream(LocationInfo.class.getRecordComponents()).map(component -> component.getName()))
                .containsExactly("locationId", "locationTitle", "locationCategory", "representativeImageUrl", "distanceMeter", "mission");
        assertThat(Arrays.stream(LocationsPage.class.getRecordComponents()).map(component -> component.getName()))
                .containsExactly("page", "size", "hasNext");
        assertThat(Arrays.stream(MissionInfo.class.getRecordComponents()).map(component -> component.getName()))
                .containsExactly("missionId", "missionType", "missionTitle");
    }
}
