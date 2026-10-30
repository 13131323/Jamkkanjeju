package com.jamkkanjeju.server.domain.mypage.service;

import com.jamkkanjeju.server.common.exception.BusinessException;
import com.jamkkanjeju.server.common.exception.CommonErrorCode;
import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.auth.repository.UserRepository;
import com.jamkkanjeju.server.domain.cooperativemission.entity.CooperativeMissionParticipant;
import com.jamkkanjeju.server.domain.cooperativemission.entity.CooperativeMissionProgress;
import com.jamkkanjeju.server.domain.cooperativemission.entity.ParticipantStatus;
import com.jamkkanjeju.server.domain.cooperativemission.repository.CooperativeMissionParticipantRepository;
import com.jamkkanjeju.server.domain.cooperativemission.repository.CooperativeMissionRepository;
import com.jamkkanjeju.server.domain.culturemission.entity.CultureMissionProgress;
import com.jamkkanjeju.server.domain.culturemission.repository.CultureMissionProgressRepository;
import com.jamkkanjeju.server.domain.culturemission.repository.CultureMissionQuizRepository;
import com.jamkkanjeju.server.domain.culturemission.repository.CultureMissionQuizRepository.QuizCount;
import com.jamkkanjeju.server.domain.culturemission.repository.CultureMissionRepository;
import com.jamkkanjeju.server.domain.map.repository.VisitedLocationRepository;
import com.jamkkanjeju.server.domain.mission.entity.Mission;
import com.jamkkanjeju.server.domain.mission.entity.MissionActivationStatus;
import com.jamkkanjeju.server.domain.mission.entity.MissionProgressStatus;
import com.jamkkanjeju.server.domain.mission.entity.MissionRewardStatus;
import com.jamkkanjeju.server.domain.mission.repository.MissionRewardStatusRepository;
import com.jamkkanjeju.server.domain.mission.service.MissionCompletionChecker;
import com.jamkkanjeju.server.domain.mypage.dto.GetMyPageResponse;
import com.jamkkanjeju.server.domain.mypage.dto.GetUserInfoResponse;
import com.jamkkanjeju.server.domain.mypage.dto.UpdateUserInfoRequest;
import com.jamkkanjeju.server.domain.onboarding.entity.ExpectationType;
import com.jamkkanjeju.server.domain.onboarding.entity.TransportationType;
import com.jamkkanjeju.server.domain.onboarding.entity.TravelStyleType;
import com.jamkkanjeju.server.domain.onboarding.service.OnboardingService;
import com.jamkkanjeju.server.domain.onboarding.entity.UserExpectation;
import com.jamkkanjeju.server.domain.onboarding.entity.UserTransportation;
import com.jamkkanjeju.server.domain.onboarding.entity.UserTravelStyle;
import com.jamkkanjeju.server.domain.onboarding.repository.UserExpectationRepository;
import com.jamkkanjeju.server.domain.onboarding.repository.UserTransportationRepository;
import com.jamkkanjeju.server.domain.onboarding.repository.UserTravelStyleRepository;
import com.jamkkanjeju.server.domain.mypage.dto.GetMyPageResponse.ArCharacterInfo;
import com.jamkkanjeju.server.domain.mypage.dto.GetMyPageResponse.AvailableMissionInfo;
import com.jamkkanjeju.server.domain.mypage.dto.GetMyPageResponse.ProgressMissionInfo;
import com.jamkkanjeju.server.domain.mypage.dto.GetMyPageResponse.SummaryInfo;
import com.jamkkanjeju.server.domain.treasurehunt.entity.ArCharacter;
import com.jamkkanjeju.server.domain.treasurehunt.entity.TreasureMissionProgress;
import com.jamkkanjeju.server.domain.treasurehunt.repository.AcquiredArCharacterRepository;
import com.jamkkanjeju.server.domain.treasurehunt.repository.AcquiredArCharacterRepository.Fragment;
import com.jamkkanjeju.server.domain.treasurehunt.repository.ArCharacterRepository;
import com.jamkkanjeju.server.domain.treasurehunt.repository.TreasureMissionProgressRepository;
import com.jamkkanjeju.server.domain.treasurehunt.repository.TreasureMissionRepository;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 사용자 프로필을 조회·변경하고 활동·AR 캐릭터 정보를 구성한다. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class MyPageService {
    private static final long COLLECTION_MIN_ID = 1L;
    private static final long COLLECTION_MAX_ID = 6L;
    private static final int AVAILABLE_MISSION_LIMIT = 3;

    private final UserRepository userRepository;
    private final OnboardingService onboardingService;
    private final UserExpectationRepository userExpectationRepository;
    private final UserTransportationRepository userTransportationRepository;
    private final UserTravelStyleRepository userTravelStyleRepository;
    private final VisitedLocationRepository visitedLocationRepository;
    private final CultureMissionProgressRepository cultureMissionProgressRepository;
    private final CultureMissionQuizRepository cultureMissionQuizRepository;
    private final TreasureMissionProgressRepository treasureMissionProgressRepository;
    private final CooperativeMissionParticipantRepository cooperativeMissionParticipantRepository;
    private final MissionCompletionChecker missionCompletionChecker;
    private final ArCharacterRepository arCharacterRepository;
    private final AcquiredArCharacterRepository acquiredArCharacterRepository;
    private final CultureMissionRepository cultureMissionRepository;
    private final TreasureMissionRepository treasureMissionRepository;
    private final CooperativeMissionRepository cooperativeMissionRepository;
    private final MissionRewardStatusRepository missionRewardStatusRepository;

    /** 현재 사용자와 온보딩 선택값을 조회하고 저장 상태를 바꾸지 않고 반환한다. */
    public GetUserInfoResponse getUserInfo(Long userId) {
        // 1. 현재 사용자 확인
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(CommonErrorCode.UNAUTHORIZED));

        // 2~3. 본인의 기대 항목·이동 수단·여행 방식을 기준 항목과 함께 조회
        List<UserExpectation> expectations = userExpectationRepository.findAllWithExpectationByUserId(userId);
        UserTransportation transportation = userTransportationRepository.findWithTransportationByUserId(userId).orElse(null);
        UserTravelStyle travelStyle = userTravelStyleRepository.findWithTravelStyleByUserId(userId).orElse(null);

        // 4. 저장된 프로필·선택값·목표 걸음 수로 응답 구성
        return GetUserInfoResponse.of(user, expectations, transportation, travelStyle);
    }

    /** 요청에 포함된 값만 변경하고 여행 선택값이 실제로 바뀔 때만 결과를 재배정한다. */
    @Transactional
    public void updateUserInfo(Long userId, UpdateUserInfoRequest request) {
        // 1~2. 현재 사용자 확인. 검증과 생략/null 구분은 요청 DTO에서 처리한다.
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(CommonErrorCode.UNAUTHORIZED));

        // 3~4. 생략한 필드는 기존 선택을 유지하며 실제 변경 여부는 순서와 무관하게 비교한다.
        if (request.hasField("expectations") || request.hasField("transportation") || request.hasField("travelStyle")) {
            List<ExpectationType> savedExpectations = userExpectationRepository.findAllWithExpectationByUserId(userId)
                    .stream().map(selection -> selection.getExpectation().getExpectationType()).toList();
            TransportationType savedTransportation = userTransportationRepository.findWithTransportationByUserId(userId)
                    .map(selection -> selection.getTransportation().getTransportationType()).orElse(null);
            TravelStyleType savedTravelStyle = userTravelStyleRepository.findWithTravelStyleByUserId(userId)
                    .map(selection -> selection.getTravelStyle().getTravelStyleType()).orElse(null);
            List<ExpectationType> expectations = request.hasField("expectations") ? request.expectations() : savedExpectations;
            TransportationType transportation = request.hasField("transportation") ? request.transportation() : savedTransportation;
            TravelStyleType travelStyle = request.hasField("travelStyle") ? request.travelStyle() : savedTravelStyle;
            boolean changed = !new HashSet<>(savedExpectations).equals(new HashSet<>(expectations))
                    || savedTransportation != transportation || savedTravelStyle != travelStyle;
            if (changed) {
                onboardingService.updateSelectionsAndAssignResult(user, expectations, transportation, travelStyle);
            }
        }

        // 5~6. 같은 트랜잭션에서 요청에 포함된 사용자 값만 반영한다.
        if (request.hasField("nickname")) {
            user.changeNickname(request.nickname());
        }
        if (request.hasField("targetStepCount")) {
            user.changeTargetStep(request.targetStepCount());
        }
    }

    /** 인증 사용자의 저장값과 조각·진행 기록을 일괄 조회하여 마이페이지 응답을 반환한다. */
    public GetMyPageResponse getMyPage(Long userId) {
        // 1. 현재 사용자 확인
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(CommonErrorCode.UNAUTHORIZED));

        // 2~3. 완료 집계·추천 제외·진행 중 목록에 사용할 진행 기록을 한 번씩 조회
        List<CultureMissionProgress> culture = cultureMissionProgressRepository.findAllByUserId(userId);
        List<TreasureMissionProgress> treasure = treasureMissionProgressRepository.findAllByUserId(userId);
        List<CooperativeMissionParticipant> participants = cooperativeMissionParticipantRepository.findAllByUserId(userId);
        List<CooperativeMissionProgress> teams = participants.stream()
                .filter(participant -> participant.getParticipantStatus() == ParticipantStatus.ACCEPTED)
                .map(CooperativeMissionParticipant::getCooperativeMissionProgress)
                .collect(Collectors.toMap(CooperativeMissionProgress::getId, Function.identity(),
                        (first, duplicate) -> first, LinkedHashMap::new)).values().stream().toList();
        long completedCount = culture.stream().filter(progress -> progress.getMissionStatus() == MissionProgressStatus.COMPLETED).count()
                + treasure.stream().filter(missionCompletionChecker::isCompleted).count()
                + teams.stream().filter(progress -> progress.getMissionStatus() == MissionProgressStatus.COMPLETED).count();
        SummaryInfo summary = SummaryInfo.of(visitedLocationRepository.countDistinctLocationsByUserId(userId), completedCount, user.getPoint());
        List<ProgressMissionInfo> progressMissions = progressMissions(culture, treasure, teams);

        // 4~5. 도감 범위의 캐릭터와 본인 조각을 생성 시각·획득 ID 순서로 조회
        List<ArCharacter> characters = arCharacterRepository.findAllByIdBetweenOrderByIdAsc(COLLECTION_MIN_ID, COLLECTION_MAX_ID);
        List<Long> characterIds = characters.stream().map(ArCharacter::getId).toList();
        List<Fragment> fragments = characterIds.isEmpty() ? List.of()
                : acquiredArCharacterRepository.findFragmentsByUserIdAndArCharacterIds(userId, characterIds);
        Map<Long, List<Fragment>> byCharacter = fragments.stream().collect(Collectors.groupingBy(Fragment::getArCharacterId));
        List<Long> incompleteIds = characters.stream()
                .filter(character -> byCharacter.getOrDefault(character.getId(), List.of()).size() < character.getRequiredFragmentCount())
                .map(ArCharacter::getId).toList();

        // 6. 완료했거나 이미 캐릭터 조각을 받은 공통 미션은 후보 전체에서 제외
        Set<Long> completedIds = culture.stream()
                .filter(progress -> progress.getMissionStatus() == MissionProgressStatus.COMPLETED)
                .map(progress -> progress.getCultureMission().getMissionId()).collect(Collectors.toSet());
        completedIds.addAll(missionCompletionChecker.completedTreasureMissionIds(treasure));
        completedIds.addAll(missionCompletionChecker.completedCooperativeMissionIds(participants));
        Map<Long, List<Mission>> available = availableMissions(userId, incompleteIds, completedIds, fragments);

        // 7. 실제 조각 개수·최초 완성 날짜와 최대 세 개의 후보로 응답 구성
        List<ArCharacterInfo> collection = characters.stream().map(character -> {
            List<Fragment> owned = byCharacter.getOrDefault(character.getId(), List.of());
            boolean acquired = owned.size() >= character.getRequiredFragmentCount();
            LocalDate acquiredAt = acquired ? owned.get(character.getRequiredFragmentCount() - 1).getCreatedAt().toLocalDate() : null;
            List<AvailableMissionInfo> missions = acquired ? List.of() : available.getOrDefault(character.getId(), List.of()).stream()
                    .limit(AVAILABLE_MISSION_LIMIT).map(AvailableMissionInfo::from).toList();
            return ArCharacterInfo.of(character, owned.size(), acquired, acquiredAt, missions);
        }).toList();
        return GetMyPageResponse.of(user, summary, progressMissions, collection);
    }

    /** 유형별 진행 수를 구성하며 역할·참가자 수로 팀을 중복 노출하지 않는다. */
    private List<ProgressMissionInfo> progressMissions(List<CultureMissionProgress> culture,
                                                       List<TreasureMissionProgress> treasure,
                                                       List<CooperativeMissionProgress> teams) {
        List<CultureMissionProgress> activeCulture = culture.stream()
                .filter(progress -> progress.getMissionStatus() == MissionProgressStatus.IN_PROGRESS).toList();
        List<Long> cultureIds = activeCulture.stream().map(progress -> progress.getCultureMission().getMissionId()).toList();
        Map<Long, Long> quizCounts = cultureIds.isEmpty() ? Map.of() : cultureMissionQuizRepository.countByCultureMissionIds(cultureIds)
                .stream().collect(Collectors.toMap(QuizCount::getCultureMissionId, QuizCount::getQuizCount));
        List<ProgressMissionInfo> result = new ArrayList<>();
        activeCulture.forEach(progress -> result.add(ProgressMissionInfo.of(progress.getCultureMission().getMission(),
                progress.getCurrentQuizIndex(), Math.toIntExact(quizCounts.getOrDefault(progress.getCultureMission().getMissionId(), 0L)))));
        treasure.stream().filter(progress -> progress.getMissionStatus() == MissionProgressStatus.IN_PROGRESS)
                .forEach(progress -> result.add(ProgressMissionInfo.of(progress.getTreasureMission().getMission(),
                        progress.getFoundItemCount(), progress.getTreasureMission().getItemTotalCount())));
        teams.stream().filter(progress -> progress.getMissionStatus() == MissionProgressStatus.IN_PROGRESS)
                .forEach(progress -> result.add(ProgressMissionInfo.of(progress.getCooperativeMission().getMission(),
                        progress.getCurrentStep(), progress.getCooperativeMission().getMission().getMissionType().getSteps().size())));
        return result;
    }

    /** 미완성 캐릭터의 활성 보상 미션을 모아 완료·기지급 조건을 제한 전에 적용한다. */
    private Map<Long, List<Mission>> availableMissions(Long userId, List<Long> characterIds,
                                                     Set<Long> completedIds, List<Fragment> fragments) {
        if (characterIds.isEmpty()) return Map.of();
        List<CharacterMission> candidates = new ArrayList<>();
        cultureMissionRepository.findAllByStatusAndArCharacterIdIn(MissionActivationStatus.ACTIVE, characterIds)
                .forEach(mission -> candidates.add(new CharacterMission(mission.getArCharacter().getId(), mission.getMission())));
        treasureMissionRepository.findAllByStatusAndArCharacterIdIn(MissionActivationStatus.ACTIVE, characterIds)
                .forEach(mission -> candidates.add(new CharacterMission(mission.getArCharacter().getId(), mission.getMission())));
        cooperativeMissionRepository.findAllByStatusAndArCharacterIdIn(MissionActivationStatus.ACTIVE, characterIds)
                .forEach(mission -> candidates.add(new CharacterMission(mission.getArCharacter().getId(), mission.getMission())));
        if (candidates.isEmpty()) return Map.of();
        List<Long> missionIds = candidates.stream().map(candidate -> candidate.mission().getId()).distinct().toList();
        Set<Long> excluded = new HashSet<>(completedIds);
        fragments.stream().map(Fragment::getMissionId).filter(Objects::nonNull).forEach(excluded::add);
        missionRewardStatusRepository.findAllByIdUserIdAndIdMissionIdIn(userId, missionIds).stream()
                .filter(MissionRewardStatus::isArCharacterRewardGranted)
                .map(status -> status.getId().getMissionId()).forEach(excluded::add);
        return candidates.stream().filter(candidate -> !excluded.contains(candidate.mission().getId()))
                .sorted(Comparator.comparing(candidate -> candidate.mission().getId()))
                .collect(Collectors.groupingBy(CharacterMission::characterId,
                        Collectors.mapping(CharacterMission::mission, Collectors.toList())));
    }

    /** 세 유형의 캐릭터 보상 설정을 동일한 후보 형태로 다룬다. */
    private record CharacterMission(Long characterId, Mission mission) { }
}
