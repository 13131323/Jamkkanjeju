package com.jamkkanjeju.server.domain.cooperativemission.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.jamkkanjeju.server.domain.cooperativemission.entity.CooperativeMissionParticipant;
import com.jamkkanjeju.server.domain.cooperativemission.entity.CooperativeMissionProgress;
import io.swagger.v3.oas.annotations.media.Schema;

/** URL 참여 요청 응답. 상태 조회에 사용할 팀 진행도와 현재 사용자의 참가 정보를 담는다. */
public record JoinCooperativeMissionResponse(
        Long cooperativeMissionProgressId,
        Long participantId,
        String participantStatus,
        /** 참가자를 새로 만들었는지 여부. 컨트롤러가 201/200 응답 상태를 정하는 데만 쓴다. */
        @JsonIgnore @Schema(hidden = true) boolean created
) {

    /** 대상 팀 진행도와 현재 사용자의 참가자, 신규 생성 여부로 응답을 만든다. */
    public static JoinCooperativeMissionResponse of(CooperativeMissionProgress progress,
                                                    CooperativeMissionParticipant participant,
                                                    boolean created) {
        return new JoinCooperativeMissionResponse(
                progress.getId(),
                participant.getId(),
                participant.getParticipantStatus().name(),
                created
        );
    }
}
