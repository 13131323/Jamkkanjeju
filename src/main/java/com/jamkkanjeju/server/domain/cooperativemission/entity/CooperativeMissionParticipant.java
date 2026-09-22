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

    public void accept(LocalDateTime joinedAt) {
        this.participantStatus = ParticipantStatus.ACCEPTED;
        this.joinedAt = joinedAt;
    }
}
