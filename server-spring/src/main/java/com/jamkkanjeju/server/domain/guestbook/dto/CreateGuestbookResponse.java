package com.jamkkanjeju.server.domain.guestbook.dto;

import com.jamkkanjeju.server.domain.guestbook.entity.Guestbook;
import com.jamkkanjeju.server.domain.guestbook.entity.LocationGuestbook;
import com.jamkkanjeju.server.domain.guestbook.entity.RoadGuestbook;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/** 저장된 방명록의 공통 내용과 유형별 위치·연결 미션을 단일 깊이로 반환한다. */
public record CreateGuestbookResponse(
        Long guestbookId,
        String guestbookType,
        Long locationId,
        String locationAlias,
        Double latitude,
        Double longitude,
        LocalDate visitedAt,
        String contentImageUrl,
        String contentWriting,
        String contentAudioUrl,
        String audioTitle,
        String contentWeather,
        BigDecimal contentTemperatureCelsius,
        String contentColorCode,
        Long missionId,
        LocalDateTime savedAt
) {

    /** 일반 방명록의 실제 방문 장소·연결 미션을 사용하고 길바닥 전용 필드는 비운다. */
    public static CreateGuestbookResponse from(LocationGuestbook locationGuestbook) {
        Long locationId = locationGuestbook.getVisitedLocation() == null ? null
                : locationGuestbook.getVisitedLocation().getLocation().getId();
        Long missionId = locationGuestbook.getMission() == null ? null : locationGuestbook.getMission().getId();
        return of(locationGuestbook.getGuestbook(), "GENERAL", locationId, null, null, null, missionId);
    }

    /** 길바닥 방명록의 별칭·좌표를 사용하고 장소 ID와 미션 ID는 비운다. */
    public static CreateGuestbookResponse from(RoadGuestbook roadGuestbook) {
        return of(roadGuestbook.getGuestbook(), "ROAD", null, roadGuestbook.getLocationAlias(),
                roadGuestbook.getLatitude(), roadGuestbook.getLongitude(), null);
    }

    /** 공통 기록의 단일 파일 URL·사용자 제목·서버 저장 시각에 유형별 정보를 붙인다. */
    private static CreateGuestbookResponse of(Guestbook guestbook, String guestbookType, Long locationId,
                                             String locationAlias, Double latitude, Double longitude, Long missionId) {
        return new CreateGuestbookResponse(guestbook.getId(), guestbookType, locationId, locationAlias, latitude,
                longitude, guestbook.getVisitedAt(), guestbook.getContentImgUrl(), guestbook.getContentWriting(),
                guestbook.getContentAudioUrl(), guestbook.getAudioTitle(), guestbook.getContentWeather(),
                guestbook.getContentTemperatureCelsius(), guestbook.getContentColorCode(), missionId,
                guestbook.getSavedAt());
    }
}
