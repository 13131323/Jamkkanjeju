package com.jamkkanjeju.server.domain.map.dto;

import com.jamkkanjeju.server.domain.guestbook.repository.RoadGuestbookRepository.Position;
import com.jamkkanjeju.server.domain.map.entity.Location;
import com.jamkkanjeju.server.domain.mission.repository.LocationMissionReference;
import java.util.List;

/** 지도 홈의 클러스터링용 간소 응답. 상세 전용 필드는 선언하지 않는다. */
public record GetClusteredMapContentsResponse(
        List<LocationInfo> locations,
        List<RoadGuestbookInfo> roadGuestbooks
) {

    /** 서비스가 조합한 장소 목록과 좌표 조회 결과로 간소 응답을 만든다. */
    public static GetClusteredMapContentsResponse of(List<LocationInfo> locations, List<Position> roadGuestbooks) {
        return new GetClusteredMapContentsResponse(List.copyOf(locations),
                roadGuestbooks.stream().map(RoadGuestbookInfo::from).toList());
    }

    /** 장소의 ID·좌표와 연결된 단일 활성 미션의 공통 ID·유형이다. */
    public record LocationInfo(
            Long id,
            double latitude,
            double longitude,
            Long missionId,
            String missionType
    ) {

        /** 서비스에서 중복을 검증한 미션 참조를 붙인다. 미션이 없으면 ID·유형을 함께 비운다. */
        public static LocationInfo of(Location location, LocationMissionReference mission) {
            return new LocationInfo(location.getId(), location.getLatitude(), location.getLongitude(),
                    mission != null ? mission.getMissionId() : null,
                    mission != null ? mission.getMissionType().name() : null);
        }
    }

    /** 길바닥 방명록의 공통 ID와 좌표만 포함한다. */
    public record RoadGuestbookInfo(Long id, double latitude, double longitude) {

        /** 본문·이미지를 조회하지 않은 위치 프로젝션을 간소 항목으로 변환한다. */
        public static RoadGuestbookInfo from(Position position) {
            return new RoadGuestbookInfo(position.getId(), position.getLatitude(), position.getLongitude());
        }
    }
}
