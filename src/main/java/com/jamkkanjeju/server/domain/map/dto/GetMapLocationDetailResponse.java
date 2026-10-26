package com.jamkkanjeju.server.domain.map.dto;

import com.jamkkanjeju.server.domain.map.dto.GetLocationMapModalResponse.GuestbookInfo;
import com.jamkkanjeju.server.domain.map.dto.GetLocationMapModalResponse.RewardDetail;
import com.jamkkanjeju.server.domain.map.entity.Location;
import com.jamkkanjeju.server.domain.mission.entity.Mission;
import java.util.List;

/** 장소 상세 정보·근처 미션·방명록 페이지와 현재 장소의 활성 미션을 담는다. */
public record GetMapLocationDetailResponse(
        String locationTitle,
        String locationCategory,
        Integer distanceMeter,
        Integer durationMinutes,
        String locationAddress,
        boolean isVisited,
        String locationDescription,
        List<String> locationImageUrls,
        List<NearbyMissionInfo> nearbyMissions,
        List<GuestbookInfo> guestbooks,
        GuestbooksPage guestbooksPage,
        MissionInfo locationMission
) {

    /** 장소에 서비스가 계산·조회한 값을 붙이며 상세 이미지가 없으면 null로 유지한다. */
    public static GetMapLocationDetailResponse of(Location location, Integer distanceMeter, Integer durationMinutes,
                                                  boolean isVisited, String locationDescription,
                                                  List<String> locationImageUrls, List<NearbyMissionInfo> nearbyMissions,
                                                  List<GuestbookInfo> guestbooks, GuestbooksPage guestbooksPage,
                                                  MissionInfo locationMission) {
        return new GetMapLocationDetailResponse(
                location.getTitle(), location.getCategory(), distanceMeter, durationMinutes, location.getAddress(),
                isVisited, locationDescription,
                locationImageUrls == null || locationImageUrls.isEmpty() ? null : List.copyOf(locationImageUrls),
                List.copyOf(nearbyMissions), List.copyOf(guestbooks), guestbooksPage, locationMission);
    }

    /** 현재 장소의 미션 공통 정보·완료 여부·전체 보상과 수령 여부이다. */
    public record MissionInfo(
            Long missionId,
            String missionType,
            String missionTitle,
            String description,
            boolean isCompleted,
            RewardDetail rewardDetail
    ) {

        /** 공통 미션과 서비스가 판단한 완료 여부·전체 보상으로 미션 정보를 구성한다. */
        public static MissionInfo of(Mission mission, boolean isCompleted, RewardDetail rewardDetail) {
            return new MissionInfo(mission.getId(), mission.getMissionType().getType().name(),
                    mission.getMissionType().getTitle(), mission.getMissionType().getDescription(),
                    isCompleted, rewardDetail);
        }
    }

    /** 추천 미션의 공통 정보와 해당 미션이 진행되는 장소·대표 이미지이다. */
    public record NearbyMissionInfo(
            Long missionId,
            String missionType,
            String missionTitle,
            String description,
            boolean isCompleted,
            RewardDetail rewardDetail,
            String locationTitle,
            String representativeImageUrl
    ) {

        /** 공통 미션 정보에 추천 대상 장소의 이름과 대표 이미지를 붙인다. */
        public static NearbyMissionInfo of(MissionInfo mission, Location location, String representativeImageUrl) {
            return new NearbyMissionInfo(mission.missionId(), mission.missionType(), mission.missionTitle(),
                    mission.description(), mission.isCompleted(), mission.rewardDetail(),
                    location.getTitle(), representativeImageUrl);
        }
    }

    /** 전체 개수 집계 없이 제공하는 방명록 페이지 번호·요청 크기·다음 페이지 여부이다. */
    public record GuestbooksPage(int page, int size, boolean hasNext) {

        /** 서비스에서 확인한 요청 페이지 조건과 다음 페이지 존재 여부를 응답으로 변환한다. */
        public static GuestbooksPage of(int page, int size, boolean hasNext) {
            return new GuestbooksPage(page, size, hasNext);
        }
    }
}
