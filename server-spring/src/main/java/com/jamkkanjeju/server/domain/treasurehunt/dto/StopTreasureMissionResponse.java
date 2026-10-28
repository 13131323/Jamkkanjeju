package com.jamkkanjeju.server.domain.treasurehunt.dto;

import com.jamkkanjeju.server.domain.map.entity.Location;
import com.jamkkanjeju.server.domain.mission.entity.Mission;
import com.jamkkanjeju.server.domain.treasurehunt.entity.TreasureMissionProgress;
import java.util.List;

/** 보물찾기 중단 응답. 완료 상태와 저장된 발견 번호, 전체 보물 개수와 다음 장소를 담는다. */
public record StopTreasureMissionResponse(
        String missionProgressStatus,
        int treasureCount,
        List<Integer> foundTreasureIndexes,
        NextLocation nextLocation
) {

    /** 완료 처리한 진행도와 실제 전체 보물 수, 정렬된 발견 번호와 추천 장소로 응답을 만든다. */
    public static StopTreasureMissionResponse of(TreasureMissionProgress progress, int treasureCount,
                                                 List<Integer> foundTreasureIndexes, NextLocation nextLocation) {
        return new StopTreasureMissionResponse(
                progress.getMissionStatus().name(), treasureCount, List.copyOf(foundTreasureIndexes), nextLocation);
    }

    /** 중단 후 추천하는 다음 장소. 이미지나 연결된 활성 미션이 없으면 해당 값은 null이다. */
    public record NextLocation(
            Long id,
            String locationTitle,
            String locationImageUrl,
            int distanceMeter,
            NextMission mission
    ) {

        /** 추천 장소와 이미지, 거리, 연결된 미션으로 장소 정보를 만든다. */
        public static NextLocation of(Location location, String locationImageUrl, int distanceMeter,
                                      NextMission mission) {
            return new NextLocation(location.getId(), location.getTitle(), locationImageUrl, distanceMeter, mission);
        }
    }

    /** 다음 장소에서 수행할 활성 미션의 공통 ID와 유형이다. */
    public record NextMission(Long id, String missionType) {

        /** 공통 미션 엔티티로 다음 미션 정보를 만든다. */
        public static NextMission from(Mission mission) {
            return new NextMission(mission.getId(), mission.getMissionType().getType().name());
        }
    }
}
