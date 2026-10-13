package com.jamkkanjeju.server.domain.home.dto;

import com.jamkkanjeju.server.domain.map.entity.Location;
import com.jamkkanjeju.server.domain.mission.entity.Mission;
import com.jamkkanjeju.server.domain.mission.entity.MissionType;
import com.jamkkanjeju.server.domain.onboarding.entity.OnboardingResult;
import java.util.List;

/** 홈 조회 응답. 추천 미션, 진행 중인 미션, 방명록 개수, 캐릭터 이미지를 담는다. */
public record GetHomeResponse(
        List<MissionRecommendInfo> missionRecommend,
        List<ProgressMissionInfo> progressMission,
        long guestbookCount,
        String characterImgUrl
) {

    /** 홈 조회 응답을 만든다. 캐릭터 이미지는 사용자의 온보딩 결과 이미지를 쓴다. */
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

    /** 홈에 노출할 추천 미션 한 건. */
    public record MissionRecommendInfo(
            Long missionId,
            String missionType,
            String missionTitle,
            String locationTitle,
            LocationInfo location,
            Integer distanceMeter,
            Integer durationMinutes
    ) {

        /** 추천 미션 항목을 만든다. 장소가 없는 미션은 장소와 거리 정보를 비워 둔다. */
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

    /** 사용자가 진행 중인 미션 한 건과 그 진행 단계. */
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

        /** 진행 중인 미션 항목을 만든다. 장소가 없는 미션은 장소와 거리 정보를 비워 둔다. */
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

    /** 추천 미션 장소의 좌표. */
    public record LocationInfo(
            double lat,
            double lng
    ) {

        /** 장소의 위도·경도로 좌표 항목을 만든다. */
        public static LocationInfo from(Location location) {
            return new LocationInfo(location.getLatitude(), location.getLongitude());
        }
    }
}
