package com.jamkkanjeju.server.domain.agent.dto;

import com.jamkkanjeju.server.domain.agent.entity.LocationSyncExecution;
import java.util.List;

/** 최초 반영과 동일 requestId 재호출에서 공통으로 반환하는 확정 결과이다. */
public record SyncLocationsResponse(String requestId, String status, int addedCount, int deletedCount,
                                     List<Long> addedContentIds, List<Long> deletedContentIds) {
    /** 저장된 완료 기록으로 최초 실행과 재호출에 동일한 응답을 구성한다. */
    public static SyncLocationsResponse from(LocationSyncExecution execution) {
        List<Long> added = List.copyOf(execution.getAddedContentIds());
        List<Long> deleted = List.copyOf(execution.getDeletedContentIds());
        return new SyncLocationsResponse(execution.getRequestId(), execution.getStatus().name(),
                added.size(), deleted.size(), added, deleted);
    }
}
