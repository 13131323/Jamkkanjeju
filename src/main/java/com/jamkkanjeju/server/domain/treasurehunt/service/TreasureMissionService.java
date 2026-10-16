package com.jamkkanjeju.server.domain.treasurehunt.service;

import com.jamkkanjeju.server.common.client.TourApiClient;
import com.jamkkanjeju.server.common.exception.BusinessException;
import com.jamkkanjeju.server.common.exception.CommonErrorCode;
import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.auth.repository.UserRepository;
import com.jamkkanjeju.server.domain.map.entity.Location;
import com.jamkkanjeju.server.domain.map.service.NextLocationRecommender;
import com.jamkkanjeju.server.domain.map.service.NextLocationRecommender.RecommendedLocation;
import com.jamkkanjeju.server.domain.mission.entity.MissionActivationStatus;
import com.jamkkanjeju.server.domain.mission.entity.MissionProgressStatus;
import com.jamkkanjeju.server.domain.mission.service.MissionRewardGranter;
import com.jamkkanjeju.server.domain.mission.service.MissionRewardGranter.GrantedReward;
import com.jamkkanjeju.server.domain.mission.service.NextMissionSelector;
import com.jamkkanjeju.server.domain.treasurehunt.dto.SaveTreasureMissionProgressLocationRequest;
import com.jamkkanjeju.server.domain.treasurehunt.dto.SaveTreasureMissionProgressRequest;
import com.jamkkanjeju.server.domain.treasurehunt.dto.SaveTreasureMissionProgressResponse;
import com.jamkkanjeju.server.domain.treasurehunt.dto.SaveTreasureMissionProgressResponse.NextLocation;
import com.jamkkanjeju.server.domain.treasurehunt.dto.SaveTreasureMissionProgressResponse.NextMission;
import com.jamkkanjeju.server.domain.treasurehunt.dto.SaveTreasureMissionProgressResponse.Reward;
import com.jamkkanjeju.server.domain.treasurehunt.dto.StartTreasureMissionLocationRequest;
import com.jamkkanjeju.server.domain.treasurehunt.dto.StartTreasureMissionResponse;
import com.jamkkanjeju.server.domain.treasurehunt.dto.StartTreasureMissionResponse.TreasureItem;
import com.jamkkanjeju.server.domain.treasurehunt.dto.StartTreasureMissionResponse.TreasureItemLocation;
import com.jamkkanjeju.server.domain.treasurehunt.entity.TreasureItemStatus;
import com.jamkkanjeju.server.domain.treasurehunt.entity.TreasureMission;
import com.jamkkanjeju.server.domain.treasurehunt.entity.TreasureMissionProgress;
import com.jamkkanjeju.server.domain.treasurehunt.entity.TreasureMissionProgressItem;
import com.jamkkanjeju.server.domain.treasurehunt.entity.TreasureMissionProgressItemId;
import com.jamkkanjeju.server.domain.treasurehunt.exception.TreasureHuntErrorCode;
import com.jamkkanjeju.server.domain.treasurehunt.repository.TreasureMissionProgressItemRepository;
import com.jamkkanjeju.server.domain.treasurehunt.repository.TreasureMissionProgressRepository;
import com.jamkkanjeju.server.domain.treasurehunt.repository.TreasureMissionRepository;
import com.jamkkanjeju.server.domain.treasurehunt.service.TreasureItemCoordinateGenerator.Coordinate;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.stream.IntStream;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 사용자의 보물찾기를 시작·이어하기·재시작하고 보물 발견과 보상 지급, 완료 상태를 저장한다. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TreasureMissionService {

    private final UserRepository userRepository;
    private final TreasureMissionRepository treasureMissionRepository;
    private final TreasureMissionProgressRepository treasureMissionProgressRepository;
    private final TreasureMissionProgressItemRepository treasureMissionProgressItemRepository;
    private final TreasureItemCoordinateGenerator coordinateGenerator;
    private final TourApiClient tourApiClient;
    private final MissionRewardGranter missionRewardGranter;
    private final NextLocationRecommender nextLocationRecommender;
    private final NextMissionSelector nextMissionSelector;
    private final Clock clock;

    /** 최초 시작은 진행도·보물을 생성하고, 이어하기는 유지하며, 완료한 진행도는 같은 ID로 재시작한다. */
    @Transactional
    public StartTreasureMissionResponse startTreasureMission(
            Long userId, Long missionId, StartTreasureMissionLocationRequest request) {
        // 1. 현재 사용자 확인
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(CommonErrorCode.UNAUTHORIZED));

        // 2. 보물찾기 미션 확인 (검증 전에는 진행도나 보물을 변경하지 않는다)
        TreasureMission mission = treasureMissionRepository.findByMissionId(missionId)
                .orElseThrow(() -> new BusinessException(TreasureHuntErrorCode.TREASURE_MISSION_NOT_FOUND));
        if (mission.getStatus() == MissionActivationStatus.INACTIVE) {
            throw new BusinessException(TreasureHuntErrorCode.TREASURE_MISSION_INACTIVE);
        }

        // 3. 현재 진행도 조회 + 4~5. 필요한 경우에만 보물 생성·재배치
        Optional<TreasureMissionProgress> savedProgress = treasureMissionProgressRepository
                .findByUserIdAndTreasureMissionMissionId(userId, missionId);
        boolean created = savedProgress.isEmpty();
        TreasureMissionProgress progress = savedProgress
                .map(existing -> resumeOrRestart(existing, request))
                .orElseGet(() -> start(user, mission, request));

        // 6. 장소 정보 및 설명 구성
        StartTreasureMissionResponse.Location location = missionLocation(mission.getLocation());

        // 7. 실제 보물 개수 및 목록 구성 (상수 3이나 미션 설정 개수로 대체하지 않는다)
        int treasureCount = Math.toIntExact(treasureMissionProgressItemRepository
                .countByIdTreasureMissionProgressId(progress.getId()));
        List<TreasureItem> items = treasureMissionProgressItemRepository
                .findAllByIdTreasureMissionProgressIdOrderByIdItemIndexAsc(progress.getId()).stream()
                .map(item -> TreasureItem.of(item, TreasureItemLocation.of(item)))
                .toList();
        return StartTreasureMissionResponse.of(progress, location, treasureCount, items, created);
    }

    /** 새로 발견한 보물을 저장하고 보상 한 종류를 지급하며, 전체 발견 시 다음 장소와 함께 완료 응답을 반환한다. */
    @Transactional
    public SaveTreasureMissionProgressResponse saveTreasureMissionProgress(
            Long userId, Long progressId,
            SaveTreasureMissionProgressLocationRequest location, SaveTreasureMissionProgressRequest request) {
        // 1. 현재 사용자 확인
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(CommonErrorCode.UNAUTHORIZED));

        // 2. 진행도와 보물찾기 미션 확인
        TreasureMissionProgress progress = treasureMissionProgressRepository
                .findByIdAndUserIdAndMissionStatus(progressId, userId, MissionProgressStatus.IN_PROGRESS)
                .orElseThrow(() -> new BusinessException(TreasureHuntErrorCode.TREASURE_MISSION_PROGRESS_NOT_FOUND));
        TreasureMission mission = progress.getTreasureMission();
        if (mission.getStatus() == MissionActivationStatus.INACTIVE) {
            throw new BusinessException(TreasureHuntErrorCode.TREASURE_MISSION_INACTIVE);
        }

        // 3. 보물 확인 및 발견 처리 (발견 거리 판정은 프론트에서 담당한다)
        TreasureMissionProgressItem item = treasureMissionProgressItemRepository
                .findById(new TreasureMissionProgressItemId(progressId, request.treasureIndex()))
                .orElseThrow(() -> new BusinessException(TreasureHuntErrorCode.TREASURE_ITEM_NOT_FOUND));
        if (item.getItemStatus() == TreasureItemStatus.FOUND) {
            throw new BusinessException(TreasureHuntErrorCode.TREASURE_ITEM_ALREADY_FOUND);
        }
        item.markFound(LocalDateTime.now(clock));
        progress.increaseFoundItemCount();

        // 4. 실제 보물 개수와 완료 판단. 전체 아이템의 발견 여부를 기준으로 한다.
        int treasureCount = Math.toIntExact(treasureMissionProgressItemRepository
                .countByIdTreasureMissionProgressId(progressId));
        List<TreasureMissionProgressItem> items = treasureMissionProgressItemRepository
                .findAllByIdTreasureMissionProgressIdOrderByIdItemIndexAsc(progressId);
        List<Integer> foundTreasureIndexes = items.stream()
                .filter(savedItem -> savedItem.getItemStatus() == TreasureItemStatus.FOUND)
                .map(TreasureMissionProgressItem::getItemIndex)
                .toList();
        boolean completed = items.stream().allMatch(savedItem -> savedItem.getItemStatus() == TreasureItemStatus.FOUND);
        if (completed) {
            progress.complete(LocalDateTime.now(clock));
        }

        // 5. 보상 계산과 중복 지급 방지 + 6. 보상 저장. 누적 발견 개수가 아니라 이번 발견 한 건의 한도이다.
        GrantedReward grantedReward = missionRewardGranter.grant(
                user, mission.getMission(), mission.getArCharacter(), mission.getPoint(), mission.getCoupon(), 1);
        Reward reward = Reward.of(grantedReward.arCharacter(), grantedReward.point(), grantedReward.coupon());
        if (!completed) {
            return SaveTreasureMissionProgressResponse.inProgress(progress, treasureCount, foundTreasureIndexes, reward);
        }

        // 7. 다음 장소 추천. 실패하면 이번 발견과 완료 처리, 보상 지급도 함께 롤백된다.
        RecommendedLocation recommended = nextLocationRecommender
                .recommend(location.latitude(), location.longitude())
                .orElseThrow(() -> new IllegalStateException(
                        "보물찾기 완료 후 추천 가능한 장소가 없습니다."
                        + " userId=" + userId
                        + ", progressId=" + progressId));
        Location nextLocation = recommended.location();
        String locationImageUrl = tourApiClient.getLocationImageUrl(nextLocation.getContentId());

        // 8. 다음 장소의 미션 구성 + 9. 응답 구성
        NextMission nextMission = nextMissionSelector.pick(nextLocation.getId()).map(NextMission::from).orElse(null);
        return SaveTreasureMissionProgressResponse.completed(
                progress, treasureCount, foundTreasureIndexes,
                NextLocation.of(nextLocation, locationImageUrl, recommended.distanceMeter(), nextMission), reward);
    }

    /** 새 진행도의 ID를 확보한 뒤 사용자 중심의 새 보물 아이템을 저장한다. */
    private TreasureMissionProgress start(User user, TreasureMission mission, StartTreasureMissionLocationRequest request) {
        TreasureMissionProgress progress = treasureMissionProgressRepository.saveAndFlush(TreasureMissionProgress.builder()
                .treasureMission(mission)
                .user(user)
                .missionStatus(MissionProgressStatus.IN_PROGRESS)
                .foundItemCount(0)
                .build());
        createItems(progress, request);
        return progress;
    }

    /** 진행 중이면 그대로 사용하고, 완료 상태라면 기존 보물을 교체해 동일한 진행도를 재시작한다. */
    private TreasureMissionProgress resumeOrRestart(
            TreasureMissionProgress progress, StartTreasureMissionLocationRequest request) {
        if (progress.getMissionStatus() == MissionProgressStatus.COMPLETED) {
            // 같은 복합 PK의 새 아이템을 저장하기 전에 기존 행의 삭제를 먼저 실행한다.
            treasureMissionProgressItemRepository.deleteAllByProgressId(progress.getId());
            progress.restart();
            createItems(progress, request);
        }
        return progress;
    }

    /** 생성한 좌표에 번호를 부여해 모든 아이템을 미발견 상태로 저장한다. */
    private void createItems(TreasureMissionProgress progress, StartTreasureMissionLocationRequest request) {
        List<Coordinate> coordinates = coordinateGenerator.generate(request.latitude(), request.longitude());
        List<TreasureMissionProgressItem> items = IntStream.range(0, coordinates.size())
                .mapToObj(index -> TreasureMissionProgressItem.builder()
                        .treasureMissionProgress(progress)
                        .itemIndex(index + 1)
                        .itemStatus(TreasureItemStatus.UNFOUND)
                        .latitude(coordinates.get(index).latitude())
                        .longitude(coordinates.get(index).longitude())
                        .build())
                .toList();
        treasureMissionProgressItemRepository.saveAllAndFlush(items);
    }

    /** 장소가 없으면 null이며, 설명을 조회하지 못하더라도 장소의 나머지 정보는 유지한다. */
    private StartTreasureMissionResponse.Location missionLocation(Location location) {
        if (location == null) {
            return null;
        }
        String overview = tourApiClient.getLocationOverview(location.getContentId());
        return StartTreasureMissionResponse.Location.of(location, firstSentence(overview));
    }

    /** 정리된 설명에서 첫 문장 종결 부호까지 반환하고, 종결 부호가 없으면 전체 설명을 사용한다. */
    private String firstSentence(String overview) {
        if (overview == null || overview.isBlank()) {
            return null;
        }
        for (int index = 0; index < overview.length(); index++) {
            char character = overview.charAt(index);
            if (character == '.' || character == '!' || character == '?') {
                return overview.substring(0, index + 1);
            }
        }
        return overview;
    }
}
