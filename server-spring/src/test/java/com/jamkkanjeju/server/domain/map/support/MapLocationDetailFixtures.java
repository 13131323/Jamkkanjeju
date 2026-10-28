package com.jamkkanjeju.server.domain.map.support;

import com.jamkkanjeju.server.domain.cooperativemission.entity.CooperativeMission;
import com.jamkkanjeju.server.domain.map.entity.Location;
import com.jamkkanjeju.server.domain.mission.entity.Mission;
import com.jamkkanjeju.server.domain.mission.entity.MissionActivationStatus;
import com.jamkkanjeju.server.domain.mission.entity.MissionTypeCode;
import com.jamkkanjeju.server.domain.mission.support.MissionFixtures;
import com.jamkkanjeju.server.domain.treasurehunt.entity.TreasureMission;
import org.springframework.test.util.ReflectionTestUtils;

/** 장소 상세 단위 테스트의 고정 좌표와 서로 다른 공통 미션 ID를 준비한다. */
public final class MapLocationDetailFixtures {
    private MapLocationDetailFixtures() { }

    /** 적도 위의 경도만 달라지는 장소로 거리순 기대 결과를 고정한다. */
    public static Location locationAt(long id, double longitude) {
        return Location.builder().id(id).contentId(9_000_000L + id).title("장소" + id).address("제주 주소")
                .category("관광지").radius(100).latitude(0).longitude(longitude).build();
    }

    /** 공통 유형 안내를 재사용하면서 고유한 미션 ID를 지정한다. */
    public static Mission mission(long id, MissionTypeCode type) {
        return Mission.builder().id(id).missionType(MissionFixtures.mission(type).getMissionType()).build();
    }

    /** 보상 설정과 공유 PK를 가진 활성 보물찾기 미션이다. */
    public static TreasureMission treasure(long id, double longitude) {
        TreasureMission mission = TreasureMission.builder().mission(mission(id, MissionTypeCode.TREASURE))
                .location(locationAt(id, longitude)).itemTotalCount(3).status(MissionActivationStatus.ACTIVE)
                .point(100).arCharacter(MissionFixtures.character()).coupon(MissionFixtures.coupon(false)).build();
        ReflectionTestUtils.setField(mission, "missionId", id);
        return mission;
    }

    /** 보상 설정과 공유 PK를 가진 활성 협동 미션이다. */
    public static CooperativeMission cooperative(long id, double longitude) {
        CooperativeMission mission = CooperativeMission.builder().mission(mission(id, MissionTypeCode.COOPERATIVE))
                .location(locationAt(id, longitude)).status(MissionActivationStatus.ACTIVE).point(150).build();
        ReflectionTestUtils.setField(mission, "missionId", id);
        return mission;
    }
}
