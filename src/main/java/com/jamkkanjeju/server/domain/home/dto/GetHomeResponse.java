package com.jamkkanjeju.server.domain.home.dto;

import com.jamkkanjeju.server.domain.map.entity.Location;
import com.jamkkanjeju.server.domain.mission.entity.Mission;
import com.jamkkanjeju.server.domain.mission.entity.MissionType;
import com.jamkkanjeju.server.domain.onboarding.entity.OnboardingResult;
import java.util.List;

public record GetHomeResponse(
        List<MissionRecommendInfo> missionRecommend,
        List<ProgressMissionInfo> progressMission,
        long guestbookCount,
        String characterImgUrl
) {

    /** 온보딩 결과가 없으면 characterImgUrl은 null이다. */
    public static GetHomeResponse of(List<MissionRecommendInfo> missionRecommend,
                                     List<ProgressMissionInfo> progressMission,
                                     long guestbookCount,
                                     OnboardingResult onboardingResult) {
        return new GetHomeResponse(
                List.copyOf(missionRecommend),
                List.copyOf(progressMission),
                guestbookCount,
                onboardingResult != null ? onboardingResult.getProfileImgUrl() : null
        );
    }

    /** 장소가 없는 미션(location == null)은 장소명, 좌표, 거리, 예상 소요 시간이 모두 null이다. */
    public record MissionRecommendInfo(
            Long missionId,
            String missionType,
            String missionTitle,
            String locationTitle,
            LocationInfo location,
            Integer distanceMeter,
            Integer durationMinutes
    ) {

        public static MissionRecommendInfo of(Mission mission, Location location,
                                              Integer distanceMeter, Integer durationMinutes) {
            MissionType missionType = mission.getMissionType();
            return new MissionRecommendInfo(
                    mission.getId(),
                    missionType.getType().name(),
                    missionType.getTitle(),
                    location != null ? location.getTitle() : null,
                    location != null ? LocationInfo.from(location) : null,
                    location != null ? distanceMeter : null,
                    location != null ? durationMinutes : null
            );
        }
    }

    /** 장소가 없는 미션(location == null)은 장소명, 거리, 예상 소요 시간이 모두 null이다. */
    public record ProgressMissionInfo(
            Long missionId,
            String missionType,
            String missionTitle,
            String locationTitle,
            Integer distanceMeter,
            Integer durationMinutes,
            int totalStep,
            int currentStep
    ) {

        public static ProgressMissionInfo of(Mission mission, Location location,
                                             Integer distanceMeter, Integer durationMinutes,
                                             int totalStep, int currentStep) {
            MissionType missionType = mission.getMissionType();
            return new ProgressMissionInfo(
                    mission.getId(),
                    missionType.getType().name(),
                    missionType.getTitle(),
                    location != null ? location.getTitle() : null,
                    location != null ? distanceMeter : null,
                    location != null ? durationMinutes : null,
                    totalStep,
                    currentStep
            );
        }
    }

    public record LocationInfo(
            double lat,
            double lng
    ) {

        public static LocationInfo from(Location location) {
            return new LocationInfo(location.getLatitude(), location.getLongitude());
        }
    }
}
