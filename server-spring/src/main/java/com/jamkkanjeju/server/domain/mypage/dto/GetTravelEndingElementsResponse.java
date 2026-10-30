package com.jamkkanjeju.server.domain.mypage.dto;

import com.jamkkanjeju.server.domain.map.dto.GetLocationMapModalResponse.RewardDetail;
import com.jamkkanjeju.server.domain.map.entity.Location;
import com.jamkkanjeju.server.domain.mission.entity.Mission;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDateTime;
import java.util.List;

/** 엽서에 선택할 방문 장소·완료 미션과 현재 포인트를 담는다. 사진은 포함하지 않는다. */
public record GetTravelEndingElementsResponse(
        int point,
        int visitedLocationCount,
        List<VisitedLocationInfo> visitedLocations,
        int completedMissionCount,
        List<CompletedMissionInfo> completedMissions
) {
    /** 최종 목록을 복사하고 필터링·중복 제거 이후 목록 길이로 개수를 구성한다. */
    public static GetTravelEndingElementsResponse of(int point, List<VisitedLocationInfo> locations,
                                                    List<CompletedMissionInfo> missions) {
        return new GetTravelEndingElementsResponse(point, locations.size(), List.copyOf(locations),
                missions.size(), List.copyOf(missions));
    }

    /** 현재 사용자가 방문한 장소의 식별자와 이름이다. */
    @Schema(name = "TravelEndingVisitedLocationInfo")
    public record VisitedLocationInfo(Long id, String locationTitle) {
        /** 방문 기록과 연결된 실제 장소를 변환한다. */
        public static VisitedLocationInfo from(Location location) {
            return new VisitedLocationInfo(location.getId(), location.getTitle());
        }
    }

    /** 활성 완료 미션의 가장 최근 완료 기록과 전체 보상이다. */
    @Schema(name = "TravelEndingCompletedMissionInfo")
    public record CompletedMissionInfo(Long missionId, String missionType, String missionTitle,
                                      String completedLocation, LocalDateTime completedAt, RewardDetail rewardDetail) {
        /** 공통 미션 ID·유형·제목에 서비스가 판정한 완료 내역과 보상을 붙인다. */
        public static CompletedMissionInfo of(Mission mission, String locationTitle, LocalDateTime completedAt,
                                              RewardDetail rewardDetail) {
            return new CompletedMissionInfo(mission.getId(), mission.getMissionType().getType().name(),
                    mission.getMissionType().getTitle(), locationTitle, completedAt, rewardDetail);
        }
    }
}
