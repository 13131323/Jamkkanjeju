package com.jamkkanjeju.server.domain.treasurehunt.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.jamkkanjeju.server.domain.treasurehunt.entity.TreasureItemStatus;
import com.jamkkanjeju.server.domain.treasurehunt.entity.TreasureMissionProgress;
import com.jamkkanjeju.server.domain.treasurehunt.entity.TreasureMissionProgressItem;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

/** 보물찾기 시작/이어하기 응답. 진행 상태와 미션 장소, 전체 보물 개수와 보물 목록을 담는다. */
public record StartTreasureMissionResponse(
        Long treasureMissionProgressId,
        String missionProgressStatus,
        Location location,
        int treasureCount,
        List<TreasureItem> treasureItems,
        /** 진행도를 새로 만들었는지 여부. 컨트롤러가 201/200 응답 상태를 정하는 데만 쓴다. */
        @JsonIgnore @Schema(hidden = true) boolean created
) {

    /** 진행도와 구성된 장소·보물 목록, DB에서 조회한 전체 보물 개수로 응답을 만든다. */
    public static StartTreasureMissionResponse of(
            TreasureMissionProgress progress,
            Location location,
            int treasureCount,
            List<TreasureItem> items,
            boolean created
    ) {
        return new StartTreasureMissionResponse(
                progress.getId(),
                progress.getMissionStatus().name(),
                location,
                treasureCount,
                List.copyOf(items),
                created
        );
    }

    /** 미션 장소 정보. 연결된 장소가 없으면 최상위 응답의 location에 null을 전달한다. */
    public record Location(
            Long locationId,
            String locationTitle,
            String locationAddress,
            String locationDescription,
            double lat,
            double lng
    ) {
        /** 장소 엔티티와 서비스에서 조회한 한 줄 설명으로 장소 응답을 만든다. */
        public static Location of(
                com.jamkkanjeju.server.domain.map.entity.Location location,
                String locationDescription
        ) {
            return new Location(
                    location.getId(),
                    location.getTitle(),
                    location.getAddress(),
                    locationDescription,
                    location.getLatitude(),
                    location.getLongitude()
            );
        }
    }

    /** 저장된 보물 한 건의 번호·좌표와 발견 여부이다. */
    public record TreasureItem(
            int treasureIndex,
            TreasureItemLocation location,
            boolean isFound
    ) {
        /** 보물 아이템과 구성된 좌표로 응답 항목을 만든다. FOUND 상태만 발견으로 표시한다. */
        public static TreasureItem of(
                TreasureMissionProgressItem item,
                TreasureItemLocation location
        ) {
            return new TreasureItem(
                    item.getItemIndex(),
                    location,
                    item.getItemStatus() == TreasureItemStatus.FOUND
            );
        }
    }

    /** 진행도 아이템에 저장된 보물의 위도·경도이다. */
    public record TreasureItemLocation(
            double lat,
            double lng
    ) {
        /** 보물 아이템의 저장 좌표로 위치 응답을 만든다. */
        public static TreasureItemLocation of(
                TreasureMissionProgressItem item
        ) {
            return new TreasureItemLocation(
                    item.getLatitude(),
                    item.getLongitude()
            );
        }
    }
}
