package com.jamkkanjeju.server.domain.cooperativemission.dto;

import com.jamkkanjeju.server.domain.cooperativemission.entity.CooperativeMissionParticipant;
import com.jamkkanjeju.server.domain.cooperativemission.entity.CooperativeMissionProgress;
import com.jamkkanjeju.server.domain.cooperativemission.entity.CooperativeMissionRoleProgress;
import com.jamkkanjeju.server.domain.cooperativemission.entity.CooperativeRoleCard;
import com.jamkkanjeju.server.domain.home.entity.Coupon;
import com.jamkkanjeju.server.domain.map.entity.Location;
import com.jamkkanjeju.server.domain.mission.entity.Mission;
import com.jamkkanjeju.server.domain.treasurehunt.entity.ArCharacter;
import java.util.List;

/** 협동 미션 상태 조회 응답. 진행 중에는 참가·역할 상태를, 완료 시에는 장소·보상 조회 결과를 담는다. */
public record GetCooperativeMissionStatusResponse(
        Long missionProgressId,
        Long missionId,
        String missionTitle,
        String missionProgressStatus,
        int currentStep,
        CompletedLocation completedLocation,
        CurrentParticipant currentParticipant,
        List<Participant> participants,
        List<RoleCard> roleCards,
        List<RoleProgress> roleProgresses,
        Integer completedRoleCount,
        Integer totalRoleCount,
        Reward reward,
        NextLocation nextLocation
) {

    /** 첫 단계·수행 단계의 응답을 만든다. 정렬과 집계는 서비스에서 수행하고 완료 관련 필드는 비운다. */
    public static GetCooperativeMissionStatusResponse inProgress(
            CooperativeMissionProgress progress, CooperativeMissionParticipant currentParticipant,
            List<CooperativeMissionParticipant> participants, List<CooperativeRoleCard> roleCards,
            List<CooperativeMissionRoleProgress> roleProgresses, int completedRoleCount, int totalRoleCount) {
        return of(progress, null, CurrentParticipant.from(currentParticipant),
                participants.stream().map(Participant::from).toList(),
                roleCards.stream().map(RoleCard::from).toList(),
                roleProgresses.stream().map(RoleProgress::from).toList(),
                completedRoleCount, totalRoleCount, null, null);
    }

    /** 완료 응답을 만든다. 사용자별 최초 완료 팀의 지급 보상 또는 재도전의 빈 보상 객체와 추천 장소를 담는다. */
    public static GetCooperativeMissionStatusResponse completed(
            CooperativeMissionProgress progress, Reward reward, NextLocation nextLocation) {
        Location location = progress.getCooperativeMission().getLocation();
        return of(progress, location != null ? CompletedLocation.from(location) : null,
                null, null, null, null, null, null, reward, nextLocation);
    }

    /** 저장된 팀 진행도와 단계별 응답 항목을 공통 미션 정보와 함께 구성한다. */
    private static GetCooperativeMissionStatusResponse of(
            CooperativeMissionProgress progress, CompletedLocation completedLocation,
            CurrentParticipant currentParticipant, List<Participant> participants, List<RoleCard> roleCards,
            List<RoleProgress> roleProgresses, Integer completedRoleCount, Integer totalRoleCount,
            Reward reward, NextLocation nextLocation) {
        Mission mission = progress.getCooperativeMission().getMission();
        return new GetCooperativeMissionStatusResponse(
                progress.getId(), mission.getId(), mission.getMissionType().getTitle(),
                progress.getMissionStatus().name(), progress.getCurrentStep(),
                completedLocation, currentParticipant, participants, roleCards, roleProgresses,
                completedRoleCount, totalRoleCount, reward, nextLocation);
    }

    /** 방명록 작성에 사용할 완료 장소의 ID와 이름이다. */
    public record CompletedLocation(Long locationId, String locationTitle) {

        /** 미션에 연결된 장소를 완료 장소로 변환한다. */
        public static CompletedLocation from(Location location) {
            return new CompletedLocation(location.getId(), location.getTitle());
        }
    }

    /** 인증된 현재 사용자의 팀 내 역할과 참여 상태이다. */
    public record CurrentParticipant(Long participantId, String participantRole, String participantStatus) {

        /** 현재 참가자의 ID·역할·상태를 공개 응답으로 변환한다. */
        public static CurrentParticipant from(CooperativeMissionParticipant participant) {
            return new CurrentParticipant(participant.getId(), participant.getParticipantRole().name(),
                    participant.getParticipantStatus().name());
        }
    }

    /** 참가자 목록에 표시할 사용자 이름과 참여 상태이다. */
    public record Participant(Long participantId, String name, String participantRole, String participantStatus) {

        /** 참가자와 연결된 사용자의 닉네임으로 목록 항목을 만든다. */
        public static Participant from(CooperativeMissionParticipant participant) {
            return new Participant(participant.getId(), participant.getUser().getNickname(),
                    participant.getParticipantRole().name(), participant.getParticipantStatus().name());
        }
    }

    /** 공통 역할 카드와 수행을 위해 찾아야 하는 대상 목록이다. */
    public record RoleCard(Long roleCardId, String roleName, String roleDescription, List<String> locationToFind) {

        /** 역할 카드 정보를 복사해 응답을 만든다. */
        public static RoleCard from(CooperativeRoleCard card) {
            return new RoleCard(card.getId(), card.getRoleName(), card.getRoleDescription(),
                    List.copyOf(card.getLocationToFind()));
        }
    }

    /** 참가자·역할 카드 조합으로 식별하는 역할 수행 및 사진 인증 상태이다. */
    public record RoleProgress(
            Long participantId,
            String participantName,
            Long roleCardId,
            String roleName,
            String progressStatus,
            String itemImgUrl
    ) {

        /** 담당 참가자와 역할 카드, 저장된 인증 결과를 응답으로 변환한다. */
        public static RoleProgress from(CooperativeMissionRoleProgress progress) {
            return new RoleProgress(progress.getParticipant().getId(),
                    progress.getParticipant().getUser().getNickname(), progress.getRoleCard().getId(),
                    progress.getRoleCard().getRoleName(), progress.getProgressStatus().name(), progress.getItemImgUrl());
        }
    }

    /** 해당 팀에서 현재 사용자에게 지급된 보상. 최초 완료에는 설정된 보상 전부, 재도전에는 모든 항목이 null이다. */
    public record Reward(RewardArCharacter arCharacter, Integer point, RewardCoupon coupon) {

        /** 조회한 실제 지급 항목으로 구성한다. 보상이 없어도 객체는 유지한다. */
        public static Reward of(ArCharacter arCharacter, Integer point, Coupon coupon) {
            return new Reward(arCharacter != null ? RewardArCharacter.from(arCharacter) : null, point,
                    coupon != null ? RewardCoupon.from(coupon) : null);
        }
    }

    /** 지급된 AR 캐릭터의 공개 정보이다. */
    public record RewardArCharacter(Long id, String name, String imageUrl) {

        /** 캐릭터의 ID·이름·이미지를 구성한다. */
        public static RewardArCharacter from(ArCharacter character) {
            return new RewardArCharacter(character.getId(), character.getName(), character.getImgUrl());
        }
    }

    /** 지급된 쿠폰의 사용처와 금액이다. */
    public record RewardCoupon(String couponLocation, int couponPrice) {

        /** 장소가 없는 쿠폰은 사용처만 null로 구성한다. */
        public static RewardCoupon from(Coupon coupon) {
            return new RewardCoupon(coupon.getLocation() != null ? coupon.getLocation().getTitle() : null,
                    coupon.getCouponPrice());
        }
    }

    /** 완료 후 추천 장소와 현재 사용자로부터의 직선거리이다. */
    public record NextLocation(
            Long id,
            String locationTitle,
            String locationImageUrl,
            int distanceMeter,
            NextMission mission
    ) {

        /** 추천된 장소·이미지·거리와 연결된 미션을 응답으로 변환한다. */
        public static NextLocation of(Location location, String locationImageUrl, int distanceMeter,
                                      NextMission mission) {
            return new NextLocation(location.getId(), location.getTitle(), locationImageUrl, distanceMeter, mission);
        }
    }

    /** 추천 장소에서 수행할 미션의 공통 ID와 유형이다. */
    public record NextMission(Long id, String missionType) {

        /** 연결된 공통 미션의 ID와 유형 코드를 구성한다. */
        public static NextMission from(Mission mission) {
            return new NextMission(mission.getId(), mission.getMissionType().getType().name());
        }
    }
}
