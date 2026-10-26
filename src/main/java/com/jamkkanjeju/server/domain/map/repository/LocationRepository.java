package com.jamkkanjeju.server.domain.map.repository;

import com.jamkkanjeju.server.domain.map.entity.Location;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 관광 장소를 조회하는 레포지토리이다.
 * 결과: 상속받은 {@code findAll(Sort.by("id"))}는 전체 장소를 ID 오름차순으로 정렬한 목록이며, 장소가 없으면 빈 목록이다.
 * 사용: 문화 미션 진행도 저장({@code PATCH /api/v2/culture-missions/{cultureMissionProgressId}/progress})의 완료 처리에서
 * 다음 장소 추천 컴포넌트가 요청 위치에서 가장 가까운 장소를 고르는 후보로 쓴다. 거리가 같으면 ID가 작은 장소를 고르도록 ID 순으로 받는다.
 * 고른 장소로 응답의 {@code nextLocation}을 구성한다.
 */
public interface LocationRepository extends JpaRepository<Location, Long> {

    /**
     * 결과: 장소 이름에 {@code keyword}가 연속된 부분 문자열로 포함되는 장소의 요청 페이지이다.
     * 장소 ID 오름차순이며 전체 개수 집계 없이 다음 페이지 존재 여부를 제공한다.
     * 연관 엔티티는 로딩하지 않고 미션 유무·사용자 거리로 제한하지 않는다. 없으면 내용이 빈 {@code Slice}이다.
     * {@code Containing}이 포함 검색 패턴과 LIKE 특수문자 이스케이프를 처리하며 내부 공백은 유지한다.
     * 사용: 지도 검색 결과 조회({@code GET /api/v2/map/search})에서 서비스가 정규화·검증된 검색어와
     * 요청 페이지·크기(기본 0·20)를 전달하여 {@code locations}와 {@code locationsPage}를 구성한다.
     * 미션·이미지·거리는 반환 페이지의 장소에 대해서만 별도로 조합한다.
     */
    // TODO: 추후 검색 정책 변경 시 검색 로직을 교체한다.
    Slice<Location> findByTitleContainingOrderByIdAsc(String keyword, Pageable pageable);

    /**
     * 결과: 지정한 위도·경도 범위 내부와 경계에 있는 장소 전체 목록이다.
     * 미션·방명록·쿠폰 존재 여부와 무관하며 연관 엔티티는 로딩하지 않고, 장소가 없으면 빈 목록이다.
     * 사용: 지도 홈 조회({@code GET /api/v2/map/contents})에서 서비스가 계산한 확장 범위를 전달한다.
     * 상세 응답은 {@code locations}의 기본 정보·거리·이미지 기준으로, 간소 응답은 장소 ID·좌표로 가공한다.
     * 범위 확장과 포함할 응답 필드 선택은 서비스에서 처리한다.
     */
    List<Location> findAllByLatitudeBetweenAndLongitudeBetween(double minLatitude, double maxLatitude,
                                                              double minLongitude, double maxLongitude);
}
