package com.jamkkanjeju.server.domain.map.repository;

import com.jamkkanjeju.server.domain.map.entity.Location;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 관광 장소를 조회하는 레포지토리이다.
 * 결과: 상속받은 {@code findAll(Sort.by("id"))}는 전체 장소를 ID 오름차순으로 정렬한 목록이며, 장소가 없으면 빈 목록이다.
 * 사용: 문화 미션 진행도 저장({@code PATCH /api/v2/culture-missions/{cultureMissionProgressId}/progress})의 완료 처리에서
 * 다음 장소 추천 컴포넌트가 요청 위치에서 가장 가까운 장소를 고르는 후보로 쓴다. 거리가 같으면 ID가 작은 장소를 고르도록 ID 순으로 받는다.
 * 고른 장소로 응답의 {@code nextLocation}을 구성한다.
 */
public interface LocationRepository extends JpaRepository<Location, Long> {
}
