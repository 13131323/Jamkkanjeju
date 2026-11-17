package com.jamkkanjeju.server.domain.etc.repository;

import com.jamkkanjeju.server.domain.etc.entity.Maintenance;
import com.jamkkanjeju.server.domain.etc.entity.MaintenanceStatus;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * 점검 공지와 예약 일정을 저장·조회한다.
 * 결과: saveAndFlush는 새 예약을 저장·flush하여 생성된 ID를 가진 엔티티를 반환한다. 연관 엔티티는 없다.
 * 사용: 점검 예약({@code POST /api/v2/agent/maintenances})의 예약 ID·문구·시각·상태 응답을 구성한다.
 */
public interface MaintenanceRepository extends JpaRepository<Maintenance, Long> {

    /**
     * 결과: 지정한 상태에 속하고 종료 예정 시각이 기준 시각보다 늦은 점검 중 시작 시각·ID 오름차순 첫 한 건이다.
     * 연관 엔티티는 없으며 조건에 맞는 점검이 없으면 빈 Optional이다.
     * 사용: 홈 조회({@code GET /api/v2/users/me/home})의 {@code maintenance} 응답을 구성한다.
     * 서비스에서 공개 대상 상태와 서버 현재 시각을 전달하여 시작 전 예약 공지도 포함한다.
     */
    Optional<Maintenance> findFirstByStatusInAndEndsAtAfterOrderByStartsAtAscIdAsc(
            Collection<MaintenanceStatus> statuses, LocalDateTime now);

    /**
     * 결과: 지정한 상태이면서 종료 시각 이하인 점검을 목표 상태로 변경하고 변경 행 수를 반환한다.
     * 사용: 점검 스케줄러·요청 필터에서 종료된 예약과 진행 중 점검을 완료 처리한다.
     * 홈 조회 응답 전에 같은 전환을 적용하여 종료된 점검의 API 차단을 해제한다.
     */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update Maintenance m set m.status = :target, m.updatedAt = :now "
            + "where m.status in :statuses and m.endsAt <= :now")
    int updateExpiredStatus(@Param("statuses") Collection<MaintenanceStatus> statuses,
                           @Param("target") MaintenanceStatus target, @Param("now") LocalDateTime now);

    /**
     * 결과: 지정한 상태이며 시작 시각 이상·종료 시각 미만인 점검을 목표 상태로 변경한 행 수이다.
     * 사용: 점검 스케줄러·요청 필터가 예약을 진행 중으로 전환하여 홈 응답과 차단 판단에 사용한다.
     * 조건부 UPDATE로 같은 예약의 반복 처리와 종료된 예약의 재시작을 방지한다.
     */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update Maintenance m set m.status = :target, m.updatedAt = :now "
            + "where m.status = :source and m.startsAt <= :now and m.endsAt > :now")
    int updateStartedStatus(@Param("source") MaintenanceStatus source, @Param("target") MaintenanceStatus target,
                           @Param("now") LocalDateTime now);

    /**
     * 결과: 지정한 상태이며 시작 시각 이상·종료 시각 미만인 점검이 한 건 이상 있는지 반환한다.
     * 사용: 요청 필터가 진행 중 점검의 존재 여부로 일반 API 호출을 차단한다. 연관 조회는 없다.
     */
    boolean existsByStatusAndStartsAtLessThanEqualAndEndsAtGreaterThan(
            MaintenanceStatus status, LocalDateTime startsAt, LocalDateTime endsAt);
}
