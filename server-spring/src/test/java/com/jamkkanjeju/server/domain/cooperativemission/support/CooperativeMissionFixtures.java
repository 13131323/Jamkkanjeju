package com.jamkkanjeju.server.domain.cooperativemission.support;

import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.cooperativemission.entity.*;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import org.springframework.test.util.ReflectionTestUtils;

/** 협동 미션 테스트의 고정 시각과 팀·참가자 생성 도우미이다. */
public final class CooperativeMissionFixtures {
    public static final Clock CLOCK = Clock.fixed(Instant.parse("2026-10-19T03:00:00Z"), ZoneId.of("Asia/Seoul"));
    public static final LocalDateTime JOINED_AT = LocalDateTime.of(2026, 10, 1, 12, 0);
    private CooperativeMissionFixtures() { }

    /** 이미 두 번째 단계까지 진행한 팀을 만든다. */
    public static CooperativeMissionProgress progress(Long id, CooperativeMission mission) {
        var progress = CooperativeMissionProgress.builder().cooperativeMission(mission).currentStep(2)
                .teamToken("existing-team-token-" + id).build();
        ReflectionTestUtils.setField(progress, "id", id);
        return progress;
    }

    /** 지정한 참가 상태·역할과 기존 합류 시각으로 참가 기록을 만든다. */
    public static CooperativeMissionParticipant participant(User user, CooperativeMissionProgress progress,
                                                            ParticipantStatus status, ParticipantRole role) {
        return CooperativeMissionParticipant.builder().user(user).cooperativeMissionProgress(progress)
                .participantStatus(status).participantRole(role)
                .joinedAt(status == ParticipantStatus.PENDING ? null : JOINED_AT).build();
    }
}
