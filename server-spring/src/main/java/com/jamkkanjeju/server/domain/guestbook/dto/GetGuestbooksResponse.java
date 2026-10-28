package com.jamkkanjeju.server.domain.guestbook.dto;

import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.guestbook.entity.Guestbook;
import com.jamkkanjeju.server.domain.guestbook.entity.LocationGuestbook;
import com.jamkkanjeju.server.domain.guestbook.entity.RoadGuestbook;
import com.jamkkanjeju.server.domain.map.entity.Location;
import com.jamkkanjeju.server.domain.mission.entity.Mission;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/** 본인의 방문 장소 전체와 일반·길바닥 방명록의 독립된 페이지를 반환한다. */
public record GetGuestbooksResponse(
        List<VisitedLocationInfo> visitedLocations,
        List<GeneralGuestbookInfo> generalGuestbooks,
        List<RoadGuestbookInfo> roadGuestbooks,
        GuestbooksPage generalGuestbooksPage,
        GuestbooksPage roadGuestbooksPage
) {

    /** 서비스에서 조합한 방문 장소·방명록 목록과 각 페이지 정보를 응답으로 구성한다. */
    public static GetGuestbooksResponse of(List<VisitedLocationInfo> visitedLocations,
                                           List<GeneralGuestbookInfo> generalGuestbooks,
                                           List<RoadGuestbookInfo> roadGuestbooks,
                                           GuestbooksPage generalGuestbooksPage, GuestbooksPage roadGuestbooksPage) {
        return new GetGuestbooksResponse(List.copyOf(visitedLocations), List.copyOf(generalGuestbooks),
                List.copyOf(roadGuestbooks), generalGuestbooksPage, roadGuestbooksPage);
    }

    /** 현재 사용자가 방문한 장소의 ID·이름이다. */
    public record VisitedLocationInfo(Long id, String locationTitle) {

        /** 방문 기록에서 조회한 장소의 공개 정보를 구성한다. */
        public static VisitedLocationInfo from(Location location) {
            return new VisitedLocationInfo(location.getId(), location.getTitle());
        }
    }

    /** 장소 연결이 유지된 일반 방명록과 현재 사용자의 좋아요 상태이다. */
    public record GeneralGuestbookInfo(
            Long id,
            Long userId,
            String characterImgUrl,
            String userNickname,
            LocationInfo location,
            LocalDate visitedAt,
            String contentImageUrl,
            String contentWriting,
            String contentAudioUrl,
            String audioTitle,
            String contentWeather,
            BigDecimal contentTemperatureCelsius,
            String contentColorCode,
            boolean isLiked,
            long likeCount,
            LocalDateTime savedAt,
            MissionInfo mission
    ) {

        /** 저장된 콘텐츠·장소·미션에 서비스에서 조회한 좋아요 여부와 개수를 붙인다. */
        public static GeneralGuestbookInfo of(LocationGuestbook locationGuestbook, boolean isLiked, long likeCount) {
            Guestbook guestbook = locationGuestbook.getGuestbook();
            User user = guestbook.getUser();
            return new GeneralGuestbookInfo(guestbook.getId(), user == null ? null : user.getId(),
                    profileImageUrl(user), user == null ? null : user.getNickname(),
                    LocationInfo.from(locationGuestbook.getVisitedLocation().getLocation()), guestbook.getVisitedAt(),
                    guestbook.getContentImgUrl(), guestbook.getContentWriting(), guestbook.getContentAudioUrl(),
                    guestbook.getAudioTitle(), guestbook.getContentWeather(), guestbook.getContentTemperatureCelsius(),
                    guestbook.getContentColorCode(), isLiked, likeCount, guestbook.getSavedAt(),
                    locationGuestbook.getMission() == null ? null : MissionInfo.from(locationGuestbook.getMission()));
        }
    }

    /** 일반 방명록이 참조하는 장소의 기본 정보이다. */
    public record LocationInfo(Long id, String locationTitle, String locationAddress, String locationCategory,
                                double latitude, double longitude) {

        /** 방문 기록에 연결된 장소의 저장값을 응답으로 변환한다. */
        public static LocationInfo from(Location location) {
            return new LocationInfo(location.getId(), location.getTitle(), location.getAddress(),
                    location.getCategory(), location.getLatitude(), location.getLongitude());
        }
    }

    /** 작성 시 연결한 미션의 공통 ID·유형·제목이다. */
    public record MissionInfo(Long id, String missionType, String missionTitle) {

        /** 현재 활성 상태·완료 여부와 관계없이 저장된 미션 연결을 표시한다. */
        public static MissionInfo from(Mission mission) {
            return new MissionInfo(mission.getId(), mission.getMissionType().getType().name(),
                    mission.getMissionType().getTitle());
        }
    }

    /** 길바닥 방명록의 별칭·좌표·콘텐츠와 현재 사용자의 좋아요 상태이다. */
    public record RoadGuestbookInfo(
            Long id,
            Long userId,
            String characterImgUrl,
            String userNickname,
            String locationAlias,
            double latitude,
            double longitude,
            LocalDate visitedAt,
            String contentImageUrl,
            String contentWriting,
            String contentAudioUrl,
            String audioTitle,
            String contentWeather,
            BigDecimal contentTemperatureCelsius,
            String contentColorCode,
            boolean isLiked,
            long likeCount,
            LocalDateTime savedAt
    ) {

        /** 작성자가 없어도 기록을 유지하며 서비스에서 조회한 좋아요 여부와 개수를 붙인다. */
        public static RoadGuestbookInfo of(RoadGuestbook roadGuestbook, boolean isLiked, long likeCount) {
            Guestbook guestbook = roadGuestbook.getGuestbook();
            User user = guestbook.getUser();
            return new RoadGuestbookInfo(guestbook.getId(), user == null ? null : user.getId(),
                    profileImageUrl(user), user == null ? null : user.getNickname(), roadGuestbook.getLocationAlias(),
                    roadGuestbook.getLatitude(), roadGuestbook.getLongitude(), guestbook.getVisitedAt(),
                    guestbook.getContentImgUrl(), guestbook.getContentWriting(), guestbook.getContentAudioUrl(),
                    guestbook.getAudioTitle(), guestbook.getContentWeather(), guestbook.getContentTemperatureCelsius(),
                    guestbook.getContentColorCode(), isLiked, likeCount, guestbook.getSavedAt());
        }
    }

    /** 유형별 요청 페이지 번호·크기와 다음 페이지 존재 여부이다. */
    public record GuestbooksPage(int page, int size, boolean hasNext) {

        /** 서비스가 확인한 유형별 페이지 정보를 응답으로 변환한다. */
        public static GuestbooksPage of(int page, int size, boolean hasNext) {
            return new GuestbooksPage(page, size, hasNext);
        }
    }

    /** 작성자나 온보딩 결과가 없으면 프로필 이미지를 비운다. */
    private static String profileImageUrl(User user) {
        return user == null || user.getOnboardingResult() == null
                ? null : user.getOnboardingResult().getProfileImgUrl();
    }
}
