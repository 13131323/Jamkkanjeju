package com.jamkkanjeju.server.domain.cooperativemission.entity;

import com.jamkkanjeju.server.domain.mission.entity.Mission;

import com.jamkkanjeju.server.common.persistence.BaseTimeEntity;
import com.jamkkanjeju.server.domain.mission.entity.MissionProgressStatus;
import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MapsId;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** 참가자별 역할 카드 수행 상태 (PK: participant_id, role_card_id) */
@Entity
@Getter
@Table(name = "cooperative_mission_role_progress")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class CooperativeMissionRoleProgress extends BaseTimeEntity {

    @EmbeddedId
    private CooperativeMissionRoleProgressId id;

    @MapsId("cooperativeMissionParticipantId")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "cooperative_mission_participant_id", nullable = false)
    private CooperativeMissionParticipant participant;

    @MapsId("cooperativeRoleCardId")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "cooperative_role_card_id", nullable = false)
    private CooperativeRoleCard roleCard;

    /** 인증 사진 (미제출이면 null) */
    @Column(name = "item_img_url", length = 500)
    private String itemImgUrl;

    @Enumerated(EnumType.STRING)
    @Column(name = "progress_status", nullable = false, length = 20)
    private MissionProgressStatus progressStatus;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Builder
    private CooperativeMissionRoleProgress(CooperativeMissionParticipant participant,
                                           CooperativeRoleCard roleCard, String itemImgUrl,
                                           MissionProgressStatus progressStatus,
                                           LocalDateTime completedAt) {
        this.id = new CooperativeMissionRoleProgressId(participant.getId(), roleCard.getId());
        this.participant = participant;
        this.roleCard = roleCard;
        this.itemImgUrl = itemImgUrl;
        this.progressStatus = progressStatus == null ? MissionProgressStatus.IN_PROGRESS : progressStatus;
        this.completedAt = completedAt;
    }

    public void complete(String itemImgUrl, LocalDateTime completedAt) {
        this.itemImgUrl = itemImgUrl;
        this.progressStatus = MissionProgressStatus.COMPLETED;
        this.completedAt = completedAt;
    }
}
