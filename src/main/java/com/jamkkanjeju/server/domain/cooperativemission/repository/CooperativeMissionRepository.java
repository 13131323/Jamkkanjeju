package com.jamkkanjeju.server.domain.cooperativemission.repository;

import com.jamkkanjeju.server.domain.cooperativemission.entity.CooperativeMission;
import com.jamkkanjeju.server.domain.mission.entity.MissionActivationStatus;
import com.jamkkanjeju.server.domain.mission.repository.LocationMissionReference;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CooperativeMissionRepository extends JpaRepository<CooperativeMission, Long> {

    /**
     * 결과: 공통 미션 ID 목록과 일치하는 협동 미션 전체 목록이며 활성 상태는 제한하지 않는다.
     * {@code mission.missionType}, {@code location}, {@code arCharacter}, {@code coupon.location}을 함께 로딩한다.
     * nullable 연관은 null로 유지하고 해당하는 미션이 없으면 빈 목록이다. 입력 ID 순서는 보장하지 않는다.
     * 사용: 지도 장소 상세 조회({@code GET /api/v2/map/locations/{locationId}})에서 서비스가
     * 활성·미완료·거리순 조건으로 선정한 미션들의 정보를 묶어 읽어 {@code nearbyMissions}를 구성한다.
     * 추천 조건 판정과 최종 거리순 정렬은 서비스의 추천 모듈에서 수행한다.
     */
    @EntityGraph(attributePaths = {"mission.missionType", "location", "arCharacter", "coupon.location"})
    List<CooperativeMission> findAllWithRewardsByMissionIdIn(Collection<Long> missionIds);

    /**
     * 결과: 장소와 활성 상태가 일치하는 협동 미션 전체 목록이며 같은 장소의 여러 행도 모두 반환한다.
     * {@code mission.missionType}, {@code arCharacter}, {@code coupon.location}을 함께 로딩한다.
     * 보상·쿠폰 사용처가 없으면 해당 연관은 null이고, 미션이 없으면 빈 목록이다.
     * 사용: 지도 모달 조회({@code GET /api/v2/map/modals})에서 서비스가 ACTIVE를 전달하고
     * 보물찾기 미션 목록과 합쳐 중복을 검증한 뒤 {@code mission}과 전체 {@code mission.rewardDetail}을 구성한다.
     * 완료 여부와 사용자별 보상 수령 여부는 서비스가 별도 조회 결과로 판정한다.
     */
    @EntityGraph(attributePaths = {"mission.missionType", "arCharacter", "coupon.location"})
    List<CooperativeMission> findAllWithRewardsByLocationIdAndStatus(Long locationId, MissionActivationStatus status);

    /**
     * 결과: 장소 ID 목록({@code locationIds})에 연결되고 활성 상태가 {@code status}인 협동 미션 전체 목록이다.
     * {@code mission.missionType}과 {@code location}을 함께 로딩하며 결과가 없으면 빈 목록이다.
     * 같은 장소의 여러 행을 합치거나 한 건만 선택하지 않는다.
     * 사용: 지도 홈 조회({@code GET /api/v2/map/contents})의 상세 응답에서 보물찾기 미션 조회 결과와 합쳐
     * 장소별 활성 미션 중복을 서비스가 검증하고 {@code locations[].mission}을 구성한다.
     * 지도 검색 결과 조회({@code GET /api/v2/map/search})에서도 현재 페이지의 장소 ID와 ACTIVE를 전달하고
     * 같은 중복 검증 후 공통 미션 ID·유형·제목만 {@code locations[].mission}에 구성한다.
     */
    @EntityGraph(attributePaths = {"mission.missionType", "location"})
    List<CooperativeMission> findAllByLocationIdInAndStatus(Collection<Long> locationIds, MissionActivationStatus status);

    /**
     * 결과: 장소 목록과 활성 상태가 일치하는 협동 미션의 장소 ID·공통 미션 ID·유형 목록이다.
     * 미션 제목·보상과 엔티티 연관을 로딩하지 않으며 결과가 없으면 빈 목록이다. 중복 장소의 행도 모두 반환한다.
     * 사용: 지도 홈 조회({@code GET /api/v2/map/contents})의 간소 응답에서 서비스가 보물찾기 미션 결과와 합쳐
     * 중복을 검증하고 {@code locations[].missionId}, {@code locations[].missionType}을 구성한다.
     */
    @Query("""
            select m.location.id as locationId, m.missionId as missionId,
                   m.mission.missionType.type as missionType
            from CooperativeMission m
            where m.location.id in :locationIds and m.status = :status
            """)
    List<LocationMissionReference> findReferencesByLocationIdsAndStatus(
            @Param("locationIds") Collection<Long> locationIds, @Param("status") MissionActivationStatus status);

    /**
     * 결과: 공통 미션 ID({@code missionId})의 협동 미션 한 건이며 활성 상태와 무관하게 조회한다.
     * {@code arCharacter}, {@code coupon}, {@code coupon.location}을 함께 로딩한다.
     * 보상이나 쿠폰 사용처가 없으면 해당 연관은 null이고, 협동 미션이 없으면 빈 {@code Optional}이다.
     * 사용: 미션 홈 조회({@code GET /api/v2/missions/{missionId}})에서 활성 상태를 서비스가 확인하고,
     * 사용자별 지급 상태를 적용해 응답의 {@code remainingReward}를 구성한다.
     */
    @EntityGraph(attributePaths = {"arCharacter", "coupon", "coupon.location"})
    Optional<CooperativeMission> findByMissionId(Long missionId);

    /**
     * 결과: 활성 상태가 {@code status}이고 장소가 연결된 협동 미션 전체 목록. 장소가 없는 미션은 제외된다.
     * 각 원소는 {@code mission.missionType}(유형·이름·단계)과 {@code location}(장소명·좌표)이 함께 로딩되어 있고,
     * 해당하는 미션이 없으면 빈 목록이다.
     * 사용: 홈 조회({@code GET /api/v2/users/me/home}) 응답의 {@code missionRecommend} 중 COOPERATIVE 추천 후보.
     * 사용자가 완료한 미션을 뺀 뒤 요청 위치에서 가장 가까운 한 건을 고른다.
     */
    @EntityGraph(attributePaths = {"mission.missionType", "location"})
    List<CooperativeMission> findAllByStatusAndLocationIsNotNull(MissionActivationStatus status);

    /**
     * 결과: 장소({@code locationId})에 연결되고 활성 상태가 {@code status}인 협동 미션 전체 목록.
     * 각 원소는 {@code mission.missionType}이 함께 로딩되어 있고, 해당하는 미션이 없으면 빈 목록이다.
     * 사용: 문화 미션 진행도 저장({@code PATCH /api/v2/culture-missions/{cultureMissionProgressId}/progress})의 완료 응답에서
     * 추천 장소의 ACTIVE 보물찾기 미션 목록과 합쳐 하나를 무작위로 골라 {@code nextLocation.mission}을 구성한다.
     */
    @EntityGraph(attributePaths = "mission.missionType")
    List<CooperativeMission> findAllByLocationIdAndStatus(Long locationId, MissionActivationStatus status);
}
