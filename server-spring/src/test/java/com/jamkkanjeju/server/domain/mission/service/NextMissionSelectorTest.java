package com.jamkkanjeju.server.domain.mission.service;

import static com.jamkkanjeju.server.domain.home.support.HomeFixtures.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.jamkkanjeju.server.domain.cooperativemission.repository.CooperativeMissionRepository;
import com.jamkkanjeju.server.domain.mission.entity.MissionActivationStatus;
import com.jamkkanjeju.server.domain.treasurehunt.repository.TreasureMissionRepository;
import java.util.List;
import org.junit.jupiter.api.Test;

/** 공통 다음 미션 선택이 활성 후보만 조회하고 후보 밖의 값을 반환하지 않는지 검증한다. */
class NextMissionSelectorTest {
    private final CooperativeMissionRepository cooperative = mock(CooperativeMissionRepository.class);
    private final TreasureMissionRepository treasure = mock(TreasureMissionRepository.class);
    private final NextMissionSelector selector = new NextMissionSelector(cooperative, treasure);

    @Test
    void 후보없음은_빈값이고_ACTIVE조건으로_양쪽을_조회한다() {
        assertThat(selector.pick(8L)).isEmpty();
        verify(cooperative).findAllByLocationIdAndStatus(8L, MissionActivationStatus.ACTIVE);
        verify(treasure).findAllByLocationIdAndStatus(8L, MissionActivationStatus.ACTIVE);
    }

    @Test
    void 협동_단일후보를_반환한다() {
        var mission = cooperativeMission(31L, null);
        when(cooperative.findAllByLocationIdAndStatus(8L, MissionActivationStatus.ACTIVE)).thenReturn(List.of(mission));
        assertThat(selector.pick(8L)).contains(mission.getMission());
    }

    @Test
    void 보물_단일후보를_반환한다() {
        var mission = treasureMission(32L, null, 3);
        when(treasure.findAllByLocationIdAndStatus(8L, MissionActivationStatus.ACTIVE)).thenReturn(List.of(mission));
        assertThat(selector.pick(8L)).contains(mission.getMission());
    }

    @Test
    void 여러후보에서도_항상_후보안의_미션을_반환한다() {
        var a = cooperativeMission(31L, null);
        var b = treasureMission(32L, null, 3);
        when(cooperative.findAllByLocationIdAndStatus(8L, MissionActivationStatus.ACTIVE)).thenReturn(List.of(a));
        when(treasure.findAllByLocationIdAndStatus(8L, MissionActivationStatus.ACTIVE)).thenReturn(List.of(b));
        for (int i = 0; i < 50; i++) assertThat(selector.pick(8L).orElseThrow()).isIn(a.getMission(), b.getMission());
    }
}
