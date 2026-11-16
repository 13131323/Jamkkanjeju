package com.jamkkanjeju.server.domain.agent.service;

import com.jamkkanjeju.server.domain.agent.dto.GetStoredLocationsRequest;
import com.jamkkanjeju.server.domain.agent.dto.GetStoredLocationsResponse;
import com.jamkkanjeju.server.domain.map.repository.LocationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 에이전트의 저장 장소 목록 조회를 담당한다. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AgentLocationService {
    private final LocationRepository locationRepository;

    /** 모든 장소를 ID 오름차순의 한 페이지로 읽는다. */
    public GetStoredLocationsResponse getStoredLocations(GetStoredLocationsRequest request) {
        return GetStoredLocationsResponse.from(locationRepository.findAllByOrderByIdAsc(
                PageRequest.of(request.page(), request.size())));
    }
}
