package com.jamkkanjeju.server.domain.map.dto;

import com.jamkkanjeju.server.domain.map.entity.Location;
import com.jamkkanjeju.server.domain.mission.entity.Mission;
import java.util.List;

/** 장소 ID순의 단일 검색 결과 목록과 다음 페이지 정보를 담는다. */
public record GetMapSearchResponse(
        List<LocationInfo> locations,
        LocationsPage locationsPage
) {

    /** 서비스가 조합한 장소 목록과 페이지 정보로 검색 응답을 만든다. */
    public static GetMapSearchResponse of(List<LocationInfo> locations, LocationsPage locationsPage) {
        return new GetMapSearchResponse(List.copyOf(locations), locationsPage);
    }

    /** 검색된 장소의 기본 정보·대표 이미지·거리와 연결된 활성 미션이다. */
    public record LocationInfo(
            Long locationId,
            String locationTitle,
            String locationCategory,
            String representativeImageUrl,
            Integer distanceMeter,
            MissionInfo mission
    ) {

        /** 저장된 장소 이름에 서비스가 조회한 이미지·거리 값·미션을 붙인다. */
        public static LocationInfo of(Location location, String representativeImageUrl, Integer distanceMeter,
                                      MissionInfo mission) {
            return new LocationInfo(location.getId(), location.getTitle(), location.getCategory(),
                    representativeImageUrl, distanceMeter, mission);
        }
    }

    /** 장소에 연결된 단일 활성 미션의 공통 ID·유형·제목이다. */
    public record MissionInfo(Long missionId, String missionType, String missionTitle) {

        /** 서비스에서 활성 상태와 중복을 확인한 공통 미션을 응답으로 변환한다. */
        public static MissionInfo from(Mission mission) {
            return new MissionInfo(mission.getId(), mission.getMissionType().getType().name(),
                    mission.getMissionType().getTitle());
        }
    }

    /** 검색 결과의 요청 페이지 번호·크기와 다음 페이지 존재 여부이다. */
    public record LocationsPage(int page, int size, boolean hasNext) {

        /** 서비스가 확인한 페이지 조건과 다음 페이지 여부를 공개 응답으로 변환한다. */
        public static LocationsPage of(int page, int size, boolean hasNext) {
            return new LocationsPage(page, size, hasNext);
        }
    }
}
