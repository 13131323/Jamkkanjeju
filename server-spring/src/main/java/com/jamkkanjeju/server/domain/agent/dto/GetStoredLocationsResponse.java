package com.jamkkanjeju.server.domain.agent.dto;

import com.jamkkanjeju.server.domain.map.entity.Location;
import java.util.List;
import org.springframework.data.domain.Slice;

/** DB의 장소 기본 필드와 다음 페이지 정보를 반환한다. */
public record GetStoredLocationsResponse(List<StoredLocation> locations, LocationsPage locationsPage) {

    /** 조회 페이지를 엔티티 참조가 없는 응답으로 변환한다. */
    public static GetStoredLocationsResponse from(Slice<Location> page) {
        return new GetStoredLocationsResponse(page.stream().map(StoredLocation::from).toList(),
                new LocationsPage(page.getNumber(), page.getSize(), page.hasNext()));
    }

    /** 외부 장소 데이터와 비교할 때 사용하는 서비스의 저장 값이다. */
    public record StoredLocation(Long locationId, Long contentId, String title, String address,
                                 String category, int radius, double latitude, double longitude) {
        /** 저장된 장소 값을 변형하지 않고 응답 필드로 옮긴다. */
        public static StoredLocation from(Location location) {
            return new StoredLocation(location.getId(), location.getContentId(), location.getTitle(),
                    location.getAddress(), location.getCategory(), location.getRadius(),
                    location.getLatitude(), location.getLongitude());
        }
    }

    /** 0 기반 페이지 번호·크기·다음 페이지 여부이다. */
    public record LocationsPage(int page, int size, boolean hasNext) {
    }
}
