package com.jamkkanjeju.server.domain.mypage.service;

import com.jamkkanjeju.server.common.exception.BusinessException;
import com.jamkkanjeju.server.common.exception.CommonErrorCode;
import com.jamkkanjeju.server.domain.culturemission.repository.CultureMissionQuizRepository;
import com.jamkkanjeju.server.domain.cooperativemission.repository.CooperativeMissionRepository;
import com.jamkkanjeju.server.domain.map.entity.Location;
import com.jamkkanjeju.server.domain.map.repository.LocationRepository;
import com.jamkkanjeju.server.domain.mypage.dto.CreateTravelEndingContentRequest.Selection;
import com.jamkkanjeju.server.domain.mypage.dto.GetTravelEndingElementsResponse.CompletedMissionInfo;
import com.jamkkanjeju.server.domain.mypage.exception.MyPageErrorCode;
import com.jamkkanjeju.server.domain.mypage.service.TravelEndingImageGenerator.Source;
import com.jamkkanjeju.server.domain.mypage.service.TravelEndingImageGenerator.SourceType;
import com.jamkkanjeju.server.domain.treasurehunt.repository.TreasureMissionRepository;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** DB 읽기 트랜잭션에서 본인의 선택 요소를 확인하고 외부 호출용 값만 분리한다. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TravelEndingContentPreparation {
    private final TravelEndingElementsService elementsService;
    private final LocationRepository locationRepository;
    private final CultureMissionQuizRepository quizRepository;
    private final TreasureMissionRepository treasureRepository;
    private final CooperativeMissionRepository cooperativeRepository;

    /** 기존 요소 조회 정책으로 방문·완료·활성 조건을 검증한다. 이 단계는 외부 통신하지 않는다. */
    public List<Source> prepare(Long userId, Selection selection) {
        var elements = elementsService.getTravelEndingElements(userId);
        if (elements.point() < TravelEndingContentWriter.CREATION_POINT_COST) {
            throw new BusinessException(MyPageErrorCode.INSUFFICIENT_POINT);
        }
        var visitedIds = elements.visitedLocations().stream().map(location -> location.id()).collect(Collectors.toSet());
        Map<Long, CompletedMissionInfo> missions = elements.completedMissions().stream()
                .collect(Collectors.toMap(CompletedMissionInfo::missionId, Function.identity()));
        if (!visitedIds.containsAll(selection.visitedLocationIds()) || !missions.keySet().containsAll(selection.missionIds())) {
            throw new BusinessException(CommonErrorCode.INVALID_REQUEST);
        }
        Map<Long, Location> locations = locationRepository.findAllById(selection.visitedLocationIds()).stream()
                .collect(Collectors.toMap(Location::getId, Function.identity()));
        if (locations.size() != selection.visitedLocationIds().size()) throw new BusinessException(CommonErrorCode.INVALID_REQUEST);

        List<Long> cultureIds = selection.missionIds().stream()
                .filter(id -> "CULTURE".equals(missions.get(id).missionType())).toList();
        Map<Long, String> quizImages = new HashMap<>();
        if (!cultureIds.isEmpty()) {
            quizRepository.findAllByIdCultureMissionIdInOrderByIdCultureMissionIdAscIdQuizIndexAsc(cultureIds).forEach(quiz -> {
                if (quiz.getImgUrl() != null && !quiz.getImgUrl().isBlank()) {
                    quizImages.putIfAbsent(quiz.getId().getCultureMissionId(), quiz.getImgUrl());
                }
            });
        }
        Map<Long, Location> missionLocations = new HashMap<>();
        treasureRepository.findAllWithRewardsByMissionIdIn(selection.missionIds()).forEach(mission -> {
            if (mission.getLocation() != null) missionLocations.put(mission.getMissionId(), mission.getLocation());
        });
        cooperativeRepository.findAllWithRewardsByMissionIdIn(selection.missionIds()).forEach(mission -> {
            if (mission.getLocation() != null) missionLocations.put(mission.getMissionId(), mission.getLocation());
        });
        List<Source> sources = new ArrayList<>();
        for (Long id : selection.visitedLocationIds()) {
            Location location = locations.get(id);
            sources.add(new Source(SourceType.VISITED_LOCATION, location.getTitle(), location.getTitle(),
                    location.getContentId(), null, null));
        }
        for (Long id : selection.missionIds()) {
            CompletedMissionInfo mission = missions.get(id);
            if ("CULTURE".equals(mission.missionType())) {
                sources.add(new Source(SourceType.MISSION, mission.missionTitle(), null, null, quizImages.get(id), null));
            } else {
                Location location = missionLocations.get(id);
                if (location == null) throw new BusinessException(CommonErrorCode.INVALID_REQUEST);
                sources.add(new Source(SourceType.MISSION, mission.missionTitle(), location.getTitle(), location.getContentId(), null, null));
            }
        }
        return List.copyOf(sources);
    }
}
