package com.jamkkanjeju.server.domain.agent.service;

import com.jamkkanjeju.server.common.exception.BusinessException;
import com.jamkkanjeju.server.common.exception.CommonErrorCode;
import com.jamkkanjeju.server.domain.agent.dto.SyncLocationsRequest;
import com.jamkkanjeju.server.domain.agent.dto.SyncLocationsResponse;
import com.jamkkanjeju.server.domain.agent.entity.LocationSyncExecution;
import com.jamkkanjeju.server.domain.agent.exception.AgentErrorCode;
import com.jamkkanjeju.server.domain.agent.repository.LocationSyncExecutionRepository;
import com.jamkkanjeju.server.domain.cooperativemission.repository.CooperativeMissionProgressRepository;
import com.jamkkanjeju.server.domain.cooperativemission.repository.CooperativeMissionRepository;
import com.jamkkanjeju.server.domain.map.entity.Location;
import com.jamkkanjeju.server.domain.map.repository.LocationRepository;
import com.jamkkanjeju.server.domain.mission.repository.MissionRewardStatusRepository;
import com.jamkkanjeju.server.domain.treasurehunt.repository.TreasureMissionProgressRepository;
import com.jamkkanjeju.server.domain.treasurehunt.repository.TreasureMissionRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

/** 승인 대상의 동일성을 확인하고 장소·미션 정리·완료 기록을 함께 커밋한다. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AgentLocationSyncService {
    private final LocationSyncExecutionRepository executions;
    private final LocationRepository locations;
    private final TreasureMissionRepository treasures;
    private final CooperativeMissionRepository cooperatives;
    private final TreasureMissionProgressRepository treasureProgresses;
    private final CooperativeMissionProgressRepository cooperativeProgresses;
    private final MissionRewardStatusRepository rewards;
    private final JsonMapper mapper;

    /** 같은 승인 요청은 저장 결과를 재사용하고 새 요청만 전체 원자적으로 반영한다. */
    @Transactional
    public SyncLocationsResponse synchronize(String idempotencyKey, SyncLocationsRequest request) {
        if (!Objects.equals(idempotencyKey, request.requestId())) throw new BusinessException(CommonErrorCode.INVALID_REQUEST);
        executions.findLockedByRequestId("__coordinator__")
                .orElseThrow(() -> new IllegalStateException("동기화 조정 행이 없습니다."));
        String hash = requestHash(request);
        var previous = executions.findById(request.requestId());
        if (previous.isPresent()) {
            if (!hash.equals(previous.get().getRequestHash()) || previous.get().getStatus() != LocationSyncExecution.Status.COMPLETED) {
                throw conflict();
            }
            return SyncLocationsResponse.from(previous.get());
        }

        List<Long> deleteIds = request.deleteLocations().stream().map(SyncLocationsRequest.DeletedLocation::locationId).sorted().toList();
        if (!deleteIds.isEmpty()) {
            var current = locations.findAllLockedByIds(deleteIds).stream().collect(Collectors.toMap(Location::getId, Location::getContentId));
            if (current.size() != deleteIds.size() || request.deleteLocations().stream()
                    .anyMatch(row -> !Objects.equals(current.get(row.locationId()), row.contentId()))) throw conflict();
        }
        List<Long> addIds = request.addLocations().stream().map(SyncLocationsRequest.AddedLocation::contentId).sorted().toList();
        if (!addIds.isEmpty() && !locations.findAllByContentIdIn(addIds).isEmpty()) throw conflict();

        try {
            if (!deleteIds.isEmpty()) cleanMissions(deleteIds);
            if (!deleteIds.isEmpty() && locations.deleteByIds(deleteIds) != deleteIds.size()) throw conflict();
            if (!request.addLocations().isEmpty()) {
                locations.saveAll(request.addLocations().stream().map(row -> Location.builder()
                        .contentId(row.contentId()).title(row.title()).address(row.address()).category(row.category())
                        .radius(row.radius()).latitude(row.latitude()).longitude(row.longitude()).build()).toList());
            }
            var saved = executions.saveAndFlush(LocationSyncExecution.builder().requestId(request.requestId())
                    .requestHash(hash).status(LocationSyncExecution.Status.COMPLETED).addedContentIds(addIds)
                    .deletedContentIds(request.deleteLocations().stream().map(SyncLocationsRequest.DeletedLocation::contentId).sorted().toList())
                    .build());
            return SyncLocationsResponse.from(saved);
        } catch (DataIntegrityViolationException exception) {
            throw conflict();
        }
    }

    /** 공통 미션과 기지급 보상은 유지하고 해당 장소의 두 미션 유형 기록만 정리한다. */
    private void cleanMissions(List<Long> locationIds) {
        var treasureMissions = treasures.findAllLockedByLocationIds(locationIds);
        var cooperativeMissions = cooperatives.findAllLockedByLocationIds(locationIds);
        List<Long> treasureIds = treasureMissions.stream().map(mission -> mission.getMissionId()).toList();
        List<Long> cooperativeIds = cooperativeMissions.stream().map(mission -> mission.getMissionId()).toList();
        treasureMissions.forEach(mission -> mission.deactivateAndUnlinkLocation());
        cooperativeMissions.forEach(mission -> mission.deactivateAndUnlinkLocation());
        locations.flush();
        if (!treasureIds.isEmpty()) treasureProgresses.deleteAllByMissionIds(treasureIds);
        if (!cooperativeIds.isEmpty()) cooperativeProgresses.deleteAllByMissionIds(cooperativeIds);
        List<Long> missionIds = new ArrayList<>(treasureIds);
        missionIds.addAll(cooperativeIds);
        if (!missionIds.isEmpty()) rewards.deleteAllByMissionIds(missionIds);
    }

    /** JSON 필드 순서와 장소 배열 순서에 의존하지 않는 정규화된 요청 해시이다. */
    private String requestHash(SyncLocationsRequest request) {
        var canonical = new SyncLocationsRequest(request.requestId(), request.storedSnapshotId(), request.tourapiSnapshotId(),
                request.addLocations().stream().sorted(Comparator.comparing(SyncLocationsRequest.AddedLocation::contentId)).toList(),
                request.deleteLocations().stream().sorted(Comparator.comparing(SyncLocationsRequest.DeletedLocation::contentId)).toList());
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(mapper.writeValueAsString(canonical).getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256을 사용할 수 없습니다.", exception);
        }
    }

    private BusinessException conflict() { return new BusinessException(AgentErrorCode.LOCATION_SYNC_CONFLICT); }
}
