package com.jamkkanjeju.server.domain.mission.service;

import static com.jamkkanjeju.server.domain.auth.support.AuthFixtures.activeUser;
import static com.jamkkanjeju.server.domain.mission.support.MissionFixtures.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.jamkkanjeju.server.common.exception.BusinessException;
import com.jamkkanjeju.server.common.exception.CommonErrorCode;
import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.auth.repository.UserRepository;
import com.jamkkanjeju.server.domain.cooperativemission.entity.CooperativeMission;
import com.jamkkanjeju.server.domain.cooperativemission.repository.CooperativeMissionRepository;
import com.jamkkanjeju.server.domain.culturemission.entity.CultureMission;
import com.jamkkanjeju.server.domain.culturemission.repository.CultureMissionRepository;
import com.jamkkanjeju.server.domain.mission.dto.GetMissionHomeResponse;
import com.jamkkanjeju.server.domain.mission.entity.*;
import com.jamkkanjeju.server.domain.mission.exception.MissionErrorCode;
import com.jamkkanjeju.server.domain.mission.repository.*;
import com.jamkkanjeju.server.domain.treasurehunt.entity.TreasureMission;
import com.jamkkanjeju.server.domain.treasurehunt.repository.TreasureMissionRepository;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/** 미션 유형별 조회와 사용자별 남은 보상 판정, 사전 오류와 조회 전용 동작을 검증한다. */
@ExtendWith(MockitoExtension.class)
class MissionServiceTest {

    @Mock UserRepository users;
    @Mock MissionRepository missions;
    @Mock CultureMissionRepository culture;
    @Mock CooperativeMissionRepository cooperative;
    @Mock TreasureMissionRepository treasure;
    @Mock MissionRewardStatusRepository rewards;
    MissionService service;
    User user;
    Mission mission;

    @BeforeEach
    void setup() {
        service = new MissionService(users, missions, culture, cooperative, treasure, rewards);
        user = activeUser(15L);
    }

    /** 공통 미션과 요청한 유형의 상세만 준비한다. */
    private void found(MissionTypeCode code, MissionActivationStatus status, boolean withRewards) {
        mission = mission(code);
        when(users.findById(15L)).thenReturn(Optional.of(user));
        when(missions.findById(31L)).thenReturn(Optional.of(mission));
        var character = withRewards ? character() : null;
        var coupon = withRewards ? coupon(true) : null;
        Integer point = withRewards ? 100 : null;
        switch (code) {
            case CULTURE -> when(culture.findByMissionId(31L)).thenReturn(Optional.of(CultureMission.builder()
                    .mission(mission).status(status).arCharacter(character).point(point).coupon(coupon).build()));
            case COOPERATIVE -> when(cooperative.findByMissionId(31L)).thenReturn(Optional.of(CooperativeMission.builder()
                    .mission(mission).status(status).arCharacter(character).point(point).coupon(coupon).build()));
            case TREASURE -> when(treasure.findByMissionId(31L)).thenReturn(Optional.of(TreasureMission.builder()
                    .mission(mission).status(status).arCharacter(character).point(point).coupon(coupon).build()));
        }
    }

    private GetMissionHomeResponse get() {
        return service.getMissionHome(15L, 31L);
    }

    private void error(Object code) {
        assertThatThrownBy(this::get).isInstanceOf(BusinessException.class).extracting("errorCode").isEqualTo(code);
    }

    @Test
    void 사용자_없으면_후속_조회하지_않는다() {
        error(CommonErrorCode.UNAUTHORIZED);
        verifyNoInteractions(missions, culture, cooperative, treasure, rewards);
    }

    @Test
    void 공통_미션_없으면_상세를_조회하지_않는다() {
        when(users.findById(15L)).thenReturn(Optional.of(user));
        error(MissionErrorCode.MISSION_NOT_FOUND);
        verifyNoInteractions(culture, cooperative, treasure, rewards);
    }

    @ParameterizedTest
    @EnumSource(MissionTypeCode.class)
    void 상세_없으면_다른_유형으로_대체하지_않는다(MissionTypeCode code) {
        when(users.findById(15L)).thenReturn(Optional.of(user));
        when(missions.findById(31L)).thenReturn(Optional.of(mission(code)));
        error(MissionErrorCode.MISSION_NOT_FOUND);
        switch (code) {
            case CULTURE -> verifyNoInteractions(cooperative, treasure);
            case COOPERATIVE -> verifyNoInteractions(culture, treasure);
            case TREASURE -> verifyNoInteractions(culture, cooperative);
        }
        verifyNoInteractions(rewards);
    }

    @ParameterizedTest
    @EnumSource(MissionTypeCode.class)
    void 비활성이면_지급_상태를_조회하지_않는다(MissionTypeCode code) {
        found(code, MissionActivationStatus.INACTIVE, true);
        error(MissionErrorCode.MISSION_INACTIVE);
        verifyNoInteractions(rewards);
    }

    @ParameterizedTest
    @EnumSource(MissionTypeCode.class)
    void 유형별_미지급_보상과_정렬된_단계를_반환한다(MissionTypeCode code) {
        found(code, MissionActivationStatus.ACTIVE, true);
        var response = get();
        assertThat(response.missionType()).isEqualTo(code.name());
        assertThat(response.remainingReward().arCharacter().id()).isEqualTo(9L);
        assertThat(response.remainingReward().point()).isEqualTo(100);
        assertThat(response.remainingReward().coupon().couponPrice()).isEqualTo(3000);
        assertThat(response.steps()).extracting(GetMissionHomeResponse.Step::step).containsExactly(1, 2);
        assertThat(mission.getMissionType().getSteps()).extracting(MissionStep::step).containsExactly(2, 1);
        verify(rewards).findById(new MissionRewardStatusId(31L, 15L));
        verifyNoMoreInteractions(rewards);
    }

    @ParameterizedTest
    @ValueSource(ints = {0, 1, 2, 3, 4, 5, 6, 7})
    void 지급_여부_8가지_조합을_독립적으로_적용한다(int flags) {
        found(MissionTypeCode.CULTURE, MissionActivationStatus.ACTIVE, true);
        var saved = MissionRewardStatus.builder().mission(mission).user(user).build();
        if ((flags & 1) != 0) saved.grantArCharacterReward();
        if ((flags & 2) != 0) saved.grantPointReward();
        if ((flags & 4) != 0) saved.grantCouponReward();
        when(rewards.findById(new MissionRewardStatusId(31L, 15L))).thenReturn(Optional.of(saved));
        var remaining = get().remainingReward();
        assertThat(remaining.arCharacter() == null).isEqualTo((flags & 1) != 0);
        assertThat(remaining.point() == null).isEqualTo((flags & 2) != 0);
        assertThat(remaining.coupon() == null).isEqualTo((flags & 4) != 0);
        assertThat(saved.isArCharacterRewardGranted()).isEqualTo((flags & 1) != 0);
        assertThat(saved.isPointRewardGranted()).isEqualTo((flags & 2) != 0);
        assertThat(saved.isCouponRewardGranted()).isEqualTo((flags & 4) != 0);
        verify(rewards, never()).save(any());
    }

    @Test
    void 보상_미설정과_반복_조회는_상태를_변경하지_않는다() {
        found(MissionTypeCode.CULTURE, MissionActivationStatus.ACTIVE, false);
        var first = get();
        assertThat(get()).isEqualTo(first);
        assertThat(first.remainingReward()).isEqualTo(new GetMissionHomeResponse.RemainingReward(null, null, null));
        assertThat(user.getPoint()).isZero();
        verify(rewards, times(2)).findById(new MissionRewardStatusId(31L, 15L));
        verifyNoMoreInteractions(rewards);
        verify(users, never()).save(any());
        verify(missions, never()).save(any());
    }

    @Test
    void DB_실패는_도메인_없음으로_변환하지_않는다() {
        found(MissionTypeCode.CULTURE, MissionActivationStatus.ACTIVE, true);
        var failure = new IllegalStateException("지급 상태 조회 실패");
        when(rewards.findById(new MissionRewardStatusId(31L, 15L))).thenThrow(failure);
        assertThatThrownBy(this::get).isSameAs(failure);
        verify(rewards, never()).save(any());
    }
}
