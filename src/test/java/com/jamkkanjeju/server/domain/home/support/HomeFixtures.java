package com.jamkkanjeju.server.domain.home.support;

import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.cooperativemission.entity.CooperativeMission;
import com.jamkkanjeju.server.domain.cooperativemission.entity.CooperativeMissionParticipant;
import com.jamkkanjeju.server.domain.cooperativemission.entity.CooperativeMissionProgress;
import com.jamkkanjeju.server.domain.cooperativemission.entity.ParticipantRole;
import com.jamkkanjeju.server.domain.cooperativemission.entity.ParticipantStatus;
import com.jamkkanjeju.server.domain.culturemission.entity.CultureMission;
import com.jamkkanjeju.server.domain.culturemission.entity.CultureMissionProgress;
import com.jamkkanjeju.server.domain.map.entity.Location;
import com.jamkkanjeju.server.domain.mission.entity.Mission;
import com.jamkkanjeju.server.domain.mission.entity.MissionActivationStatus;
import com.jamkkanjeju.server.domain.mission.entity.MissionProgressStatus;
import com.jamkkanjeju.server.domain.mission.entity.MissionStep;
import com.jamkkanjeju.server.domain.mission.entity.MissionType;
import com.jamkkanjeju.server.domain.mission.entity.MissionTypeCode;
import com.jamkkanjeju.server.domain.treasurehunt.entity.TreasureMission;
import com.jamkkanjeju.server.domain.treasurehunt.entity.TreasureMissionProgress;
import java.util.List;
import java.util.stream.IntStream;
import org.springframework.test.util.ReflectionTestUtils;

/** 홈 조회 단위 테스트에서 공통으로 쓰는 미션·장소·진행 기록 생성 도우미이다. */
public final class HomeFixtures {

    /** 협동·보물찾기 미션 유형의 기본 단계 수 */
    public static final int DEFAULT_STEP_COUNT = 3;

    private HomeFixtures() {
    }

    /** 단계 수를 지정한 미션 유형을 만든다. 유형 이름은 "<유형> 미션"이다. */
    public static MissionType missionType(MissionTypeCode code, int stepCount) {
        return MissionType.builder()
                .id((long) code.ordinal() + 1)
                .type(code)
                .title(code.name() + " 미션")
                .description(code.name() + " 설명")
                .steps(IntStream.rangeClosed(1, stepCount)
                        .mapToObj(step -> new MissionStep(step, "단계 " + step, "설명 " + step))
                        .toList())
                .build();
    }

    /** 공통 미션 ID와 유형으로 공통 미션을 만든다. */
    public static Mission mission(Long id, MissionTypeCode code) {
        return Mission.builder().id(id).missionType(missionType(code, DEFAULT_STEP_COUNT)).build();
    }

    /** 장소명과 좌표로 미션 장소를 만든다. */
    public static Location location(Long id, String title, double latitude, double longitude) {
        return Location.builder()
                .id(id)
                .contentId(id)
                .title(title)
                .address(title + " 주소")
                .category("관광지")
                .radius(50)
                .latitude(latitude)
                .longitude(longitude)
                .build();
    }

    /** 활성 상태의 보물찾기 미션을 만든다. */
    public static TreasureMission treasureMission(Long missionId, Location location, int itemTotalCount) {
        TreasureMission treasureMission = TreasureMission.builder()
                .mission(mission(missionId, MissionTypeCode.TREASURE))
                .location(location)
                .itemTotalCount(itemTotalCount)
                .status(MissionActivationStatus.ACTIVE)
                .build();
        ReflectionTestUtils.setField(treasureMission, "missionId", missionId);
        return treasureMission;
    }

    /** 활성 상태의 협동 미션을 만든다. */
    public static CooperativeMission cooperativeMission(Long missionId, Location location) {
        CooperativeMission cooperativeMission = CooperativeMission.builder()
                .mission(mission(missionId, MissionTypeCode.COOPERATIVE))
                .location(location)
                .status(MissionActivationStatus.ACTIVE)
                .build();
        ReflectionTestUtils.setField(cooperativeMission, "missionId", missionId);
        return cooperativeMission;
    }

    /** 활성 상태의 문화 미션을 만든다. */
    public static CultureMission cultureMission(Long missionId) {
        CultureMission cultureMission = CultureMission.builder()
                .mission(mission(missionId, MissionTypeCode.CULTURE))
                .status(MissionActivationStatus.ACTIVE)
                .build();
        ReflectionTestUtils.setField(cultureMission, "missionId", missionId);
        return cultureMission;
    }

    /** 사용자의 보물찾기 진행 기록을 만든다. */
    public static TreasureMissionProgress treasureProgress(User user, TreasureMission treasureMission,
                                                           int foundItemCount, MissionProgressStatus status) {
        return TreasureMissionProgress.builder()
                .user(user)
                .treasureMission(treasureMission)
                .foundItemCount(foundItemCount)
                .missionStatus(status)
                .build();
    }

    /** 협동 미션의 팀 진행 기록을 만든다. */
    public static CooperativeMissionProgress cooperativeProgress(Long id, CooperativeMission cooperativeMission,
                                                                 int currentStep, MissionProgressStatus status) {
        CooperativeMissionProgress progress = CooperativeMissionProgress.builder()
                .cooperativeMission(cooperativeMission)
                .currentStep(currentStep)
                .missionStatus(status)
                .teamToken("team-" + id)
                .build();
        ReflectionTestUtils.setField(progress, "id", id);
        return progress;
    }

    /** 사용자가 협동 미션 팀에 참가한 기록을 만든다. */
    public static CooperativeMissionParticipant participant(User user, CooperativeMissionProgress progress,
                                                            ParticipantStatus participantStatus) {
        return CooperativeMissionParticipant.builder()
                .user(user)
                .cooperativeMissionProgress(progress)
                .participantStatus(participantStatus)
                .participantRole(ParticipantRole.MEMBER)
                .build();
    }

    /** 사용자의 문화 미션 진행 기록을 만든다. */
    public static CultureMissionProgress cultureProgress(User user, CultureMission cultureMission,
                                                         int currentQuizIndex) {
        return CultureMissionProgress.builder()
                .user(user)
                .cultureMission(cultureMission)
                .currentQuizIndex(currentQuizIndex)
                .missionStatus(MissionProgressStatus.IN_PROGRESS)
                .build();
    }

    /** 여러 문화 미션을 한 번에 만든다. */
    public static List<CultureMission> cultureMissions(Long... missionIds) {
        return List.of(missionIds).stream().map(HomeFixtures::cultureMission).toList();
    }
}
