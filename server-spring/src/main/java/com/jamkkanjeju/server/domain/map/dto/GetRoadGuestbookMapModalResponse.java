package com.jamkkanjeju.server.domain.map.dto;

import com.jamkkanjeju.server.domain.guestbook.entity.Guestbook;
import com.jamkkanjeju.server.domain.guestbook.entity.RoadGuestbook;
import com.jamkkanjeju.server.domain.map.service.TravelEstimator.TravelEstimate;
import java.time.LocalDate;

/** 길바닥 방명록 모달의 작성자·위치 별칭·거리·방문일과 저장된 콘텐츠이다. */
public record GetRoadGuestbookMapModalResponse(
        Long id,
        String userNickname,
        String characterImgUrl,
        String locationAlias,
        Integer distanceMeter,
        Integer durationMinutes,
        LocalDate visitedAt,
        String contentImageUrl,
        String contentWriting,
        String contentAudioUrl,
        String contentWeather,
        String contentColorCode
) {

    /** 공통 방명록의 단일 이미지·음성 URL을 그대로 사용하며 작성자·온보딩 결과가 없으면 해당 작성자 정보를 null로 구성한다. */
    public static GetRoadGuestbookMapModalResponse of(RoadGuestbook roadGuestbook, TravelEstimate travel) {
        Guestbook guestbook = roadGuestbook.getGuestbook();
        return new GetRoadGuestbookMapModalResponse(roadGuestbook.getGuestbookId(),
                guestbook.getUser() == null ? null : guestbook.getUser().getNickname(),
                guestbook.getUser() == null || guestbook.getUser().getOnboardingResult() == null
                        ? null : guestbook.getUser().getOnboardingResult().getProfileImgUrl(),
                roadGuestbook.getLocationAlias(), travel.distanceMeter(), travel.durationMinutes(),
                guestbook.getVisitedAt(), guestbook.getContentImgUrl(), guestbook.getContentWriting(),
                guestbook.getContentAudioUrl(), guestbook.getContentWeather(), guestbook.getContentColorCode());
    }
}
