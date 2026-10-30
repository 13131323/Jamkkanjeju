package com.jamkkanjeju.server.domain.mypage.dto;

import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.mission.entity.Mission;
import com.jamkkanjeju.server.domain.onboarding.entity.OnboardingResult;
import com.jamkkanjeju.server.domain.treasurehunt.entity.ArCharacter;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDate;
import java.util.List;

/** 사용자 프로필·활동 요약·진행 중인 미션·캐릭터 도감을 담는 마이페이지 조회 응답이다. */
public record GetMyPageResponse(
        ProfileInfo profile,
        DailyStepInfo dailyStep,
        SummaryInfo summary,
        List<ProgressMissionInfo> progressMissions,
        List<ArCharacterInfo> arCharacters
) {
    /** 사용자 저장값과 서비스가 구성한 집계·목록으로 응답을 만든다. */
    public static GetMyPageResponse of(User user, SummaryInfo summary,
                                       List<ProgressMissionInfo> progressMissions, List<ArCharacterInfo> arCharacters) {
        return new GetMyPageResponse(ProfileInfo.from(user), DailyStepInfo.from(user), summary,
                List.copyOf(progressMissions), List.copyOf(arCharacters));
    }

    /** 온보딩 결과를 사용하는 사용자 프로필이다. */
    public record ProfileInfo(String nickname, TravelStyleInfo travelStyle, String characterImgUrl) {
        /** 사용자와 연결된 온보딩 결과를 프로필로 변환한다. */
        public static ProfileInfo from(User user) {
            OnboardingResult result = user.getOnboardingResult();
            return new ProfileInfo(user.getNickname(), result == null ? null : TravelStyleInfo.from(result),
                    result == null ? null : result.getProfileImgUrl());
        }
    }

    /** 온보딩 진단 여행 유형과 해시태그다. */
    public record TravelStyleInfo(String userType, List<String> hashtags) {
        /** 온보딩의 유형명과 해시태그를 복사한다. */
        public static TravelStyleInfo from(OnboardingResult result) {
            return new TravelStyleInfo(result.getUserType(), List.copyOf(result.getHashtags()));
        }
    }

    /** 현재 설정된 하루 목표 걸음 수다. */
    public record DailyStepInfo(int targetStepCount) {
        /** 저장된 목표 걸음 수를 반환한다. */
        public static DailyStepInfo from(User user) { return new DailyStepInfo(user.getTargetStep()); }
    }

    /** 방문 장소·완료 진행도 수와 현재 포인트 잔액이다. */
    public record SummaryInfo(long visitedLocationCount, long completedMissionCount, int point) {
        /** 서비스가 집계한 활동 수와 현재 잔액을 담는다. */
        public static SummaryInfo of(long visitedLocationCount, long completedMissionCount, int point) {
            return new SummaryInfo(visitedLocationCount, completedMissionCount, point);
        }
    }

    /** 공통 미션 식별자와 유형별 진행 수다. */
    @Schema(name = "MyPageProgressMissionInfo")
    public record ProgressMissionInfo(Long missionId, String missionType, String missionTitle,
                                      int currentCount, int totalCount) {
        /** 공통 미션 정보와 유형별 진행 수를 담는다. */
        public static ProgressMissionInfo of(Mission mission, int currentCount, int totalCount) {
            return new ProgressMissionInfo(mission.getId(), mission.getMissionType().getType().name(),
                    mission.getMissionType().getTitle(), currentCount, totalCount);
        }
    }

    /** 도감 캐릭터의 실제 정보·조각 집계와 아직 획득 가능한 미션이다. */
    public record ArCharacterInfo(
            Long id, String name, String imageUrl, String characterColor,
            int requiredFragmentCount, int acquiredFragmentCount, boolean isAcquired, LocalDate acquiredAt,
            String storyTitle, String storyContent, List<String> hashtags, String acquireCondition,
            List<AvailableMissionInfo> availableMissions
    ) {
        /** 캐릭터 저장값과 서비스가 계산한 조각·완성 정보를 담는다. */
        public static ArCharacterInfo of(ArCharacter character, int acquiredFragmentCount, boolean isAcquired,
                                         LocalDate acquiredAt, List<AvailableMissionInfo> availableMissions) {
            return new ArCharacterInfo(character.getId(), character.getName(), character.getImgUrl(),
                    character.getRepresentativeColor(), character.getRequiredFragmentCount(), acquiredFragmentCount,
                    isAcquired, acquiredAt, character.getStoryTitle(), character.getDescription(),
                    List.copyOf(character.getHashtags()), character.getAcquireCondition(), List.copyOf(availableMissions));
        }
    }

    /** 현재 사용자가 캐릭터 조각을 받을 수 있는 미션 한 건이다. */
    public record AvailableMissionInfo(Long missionId, String missionType, String missionTitle) {
        /** 획득 가능 미션의 공통 ID·유형·제목을 담는다. */
        public static AvailableMissionInfo from(Mission mission) {
            return new AvailableMissionInfo(mission.getId(), mission.getMissionType().getType().name(),
                    mission.getMissionType().getTitle());
        }
    }
}
