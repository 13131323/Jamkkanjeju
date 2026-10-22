package com.jamkkanjeju.server.domain.cooperativemission.entity;

import com.jamkkanjeju.server.common.persistence.BaseTimeEntity;
import com.jamkkanjeju.server.domain.auth.entity.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** 협동 미션 팀에 초대되거나 합류한 사용자와 그 팀 내 역할(방장/팀원)을 나타내는 참가자이다. */
@Entity
@Getter
@Table(
        name = "cooperative_mission_participant",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_cooperative_mission_participant_progress_user",
                columnNames = {"cooperative_mission_progress_id", "user_id"})
)
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class CooperativeMissionParticipant extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "cooperative_mission_progress_id", nullable = false)
    private CooperativeMissionProgress cooperativeMissionProgress;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(name = "participant_status", nullable = false, length = 20)
    private ParticipantStatus participantStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "participant_role", nullable = false, length = 20)
    private ParticipantRole participantRole;

    @Column(name = "joined_at")
    private LocalDateTime joinedAt;

    /** 협동 미션 팀 참가자를 생성한다. 상태를 주지 않으면 수락 대기 상태로 시작한다. */
    @Builder
    private CooperativeMissionParticipant(CooperativeMissionProgress cooperativeMissionProgress,
                                          User user, ParticipantStatus participantStatus,
                                          ParticipantRole participantRole, LocalDateTime joinedAt) {
        this.cooperativeMissionProgress = cooperativeMissionProgress;
        this.user = user;
        this.participantStatus = participantStatus == null ? ParticipantStatus.PENDING : participantStatus;
        this.participantRole = participantRole;
        this.joinedAt = joinedAt;
    }

    /** 팀 합류를 수락 처리하고 합류 시각을 기록한다. */
    public void accept(LocalDateTime joinedAt) {
        this.participantStatus = ParticipantStatus.ACCEPTED;
        this.joinedAt = joinedAt;
    }

    /** 기존 참가 정보와 역할 배정을 유지한 채 방장 권한만 승계받는다. */
    public void promoteToHost() {
        this.participantRole = ParticipantRole.HOST;
    }
}
