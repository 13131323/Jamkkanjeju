package com.jamkkanjeju.server.domain.agent.repository;

import com.jamkkanjeju.server.domain.agent.entity.LocationSyncExecution;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** 결과: saveAndFlush는 동기화 완료 기록을 저장한다. 사용: POST /api/v2/agent/locations/sync의 멱등성 결과이다. */
public interface LocationSyncExecutionRepository extends JpaRepository<LocationSyncExecution, String> {
    /** 결과: 지정 ID의 실행 기록을 쓰기 잠금으로 조회하며 없으면 Optional.empty이다. 연관은 없다.
     * 사용: POST /api/v2/agent/locations/sync에서 내부 조정 행을 잠가 동기화를 직렬화한다. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select e from LocationSyncExecution e where e.requestId = :requestId")
    Optional<LocationSyncExecution> findLockedByRequestId(@Param("requestId") String requestId);
}
