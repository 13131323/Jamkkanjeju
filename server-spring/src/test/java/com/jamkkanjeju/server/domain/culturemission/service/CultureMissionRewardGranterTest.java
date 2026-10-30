package com.jamkkanjeju.server.domain.culturemission.service;

import com.jamkkanjeju.server.domain.mission.entity.MissionRewardStatus;
import com.jamkkanjeju.server.domain.mission.entity.MissionRewardStatusId;

import static com.jamkkanjeju.server.domain.auth.support.AuthFixtures.activeUser;
import static com.jamkkanjeju.server.domain.culturemission.support.CultureMissionFixtures.cultureMission;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.culturemission.entity.*;
import com.jamkkanjeju.server.domain.mission.repository.MissionRewardStatusRepository;
import com.jamkkanjeju.server.domain.mission.service.MissionRewardGranter;
import com.jamkkanjeju.server.domain.home.entity.*;
import com.jamkkanjeju.server.domain.home.repository.AcquiredCouponRepository;
import com.jamkkanjeju.server.domain.mission.entity.MissionActivationStatus;
import com.jamkkanjeju.server.domain.treasurehunt.entity.*;
import com.jamkkanjeju.server.domain.treasurehunt.repository.AcquiredArCharacterRepository;
import java.time.*;
import java.util.Optional;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

/** 보상 순서·개수 제한과 재도전 이력 및 획득 기록 중복 방지를 검증한다. */
@ExtendWith(MockitoExtension.class)
class CultureMissionRewardGranterTest {
    @Mock MissionRewardStatusRepository statuses;
    @Mock AcquiredArCharacterRepository characters;
    @Mock AcquiredCouponRepository coupons;
    final Clock clock=Clock.fixed(Instant.parse("2026-10-15T03:00:00Z"),ZoneId.of("Asia/Seoul"));
    CultureMissionRewardGranter granter;
    User user;CultureMission mission;ArCharacter character;Coupon coupon;
    @BeforeEach void setup() {
        granter=new CultureMissionRewardGranter(new MissionRewardGranter(statuses,characters,coupons,clock));
        user=activeUser(15L);mission=cultureMission(31L,MissionActivationStatus.ACTIVE);
        character=ArCharacter.builder().requiredFragmentCount(10).id(9L).name("돌담이").imgUrl("character.png").build();
        coupon=Coupon.builder().id(10L).couponPrice(3000).build();
        ReflectionTestUtils.setField(mission,"arCharacter",character);
        ReflectionTestUtils.setField(mission,"point",100);
        ReflectionTestUtils.setField(mission,"coupon",coupon);
    }
    @ParameterizedTest @ValueSource(ints={0,1,2,3,5})
    void grantsOnlyCorrectCountInCharacterPointCouponOrder(int count) {
        user.addPoint(20);
        var reward=granter.grant(user,mission,count);
        assertThat(reward.arCharacter()).isEqualTo(count>=1?character:null);
        assertThat(reward.point()).isEqualTo(count>=2?100:null);
        assertThat(reward.coupon()).isEqualTo(count>=3?coupon:null);
        assertThat(user.getPoint()).isEqualTo(count>=2?120:20);
        if(count==0) { verifyNoInteractions(characters,coupons);verify(statuses,never()).save(any());return; }
        var status=ArgumentCaptor.forClass(MissionRewardStatus.class);
        verify(statuses).save(status.capture());
        assertThat(status.getValue().isArCharacterRewardGranted()).isTrue();
        assertThat(status.getValue().isPointRewardGranted()).isEqualTo(count>=2);
        assertThat(status.getValue().isCouponRewardGranted()).isEqualTo(count>=3);
        var acquired=ArgumentCaptor.forClass(AcquiredArCharacter.class);
        verify(characters).save(acquired.capture());
        assertThat(acquired.getValue().getMission().getId()).isEqualTo(31L);
        assertThat(acquired.getValue().getUser()).isSameAs(user);
        if(count>=3) {
            var acquiredCoupon=ArgumentCaptor.forClass(AcquiredCoupon.class);
            verify(coupons).save(acquiredCoupon.capture());
            assertThat(acquiredCoupon.getValue().getAcquiredAt()).isEqualTo(LocalDateTime.now(clock));
        } else verifyNoInteractions(coupons);
    }
    @Test void retrySkipsPreviouslyGrantedCharacterAndPreservesItsFlag() {
        var status=MissionRewardStatus.builder().user(user).mission(mission.getMission()).build();
        status.grantArCharacterReward();
        when(statuses.findById(new MissionRewardStatusId(31L,15L))).thenReturn(Optional.of(status));
        var reward=granter.grant(user,mission,1);
        assertThat(reward.point()).isEqualTo(100);assertThat(reward.arCharacter()).isNull();
        assertThat(reward.coupon()).isNull();assertThat(status.isArCharacterRewardGranted()).isTrue();
        assertThat(status.isPointRewardGranted()).isTrue();assertThat(status.isCouponRewardGranted()).isFalse();
        verifyNoInteractions(characters,coupons);
    }
    @Test void noRemainingRewardsDoesNotWriteOrPay() {
        var status=MissionRewardStatus.builder().user(user).mission(mission.getMission()).build();
        status.grantArCharacterReward();status.grantPointReward();status.grantCouponReward();
        when(statuses.findById(new MissionRewardStatusId(31L,15L))).thenReturn(Optional.of(status));
        assertThat(granter.grant(user,mission,3)).isEqualTo(CultureMissionRewardGranter.GrantedReward.NONE);
        assertThat(user.getPoint()).isZero();verifyNoInteractions(characters,coupons);verify(statuses,never()).save(any());
    }
    @Test void unconfiguredRewardsAreExcludedRatherThanConsumingCorrectCount() {
        ReflectionTestUtils.setField(mission,"arCharacter",null);
        ReflectionTestUtils.setField(mission,"point",null);
        assertThat(granter.grant(user,mission,1).coupon()).isSameAs(coupon);
        verifyNoInteractions(characters);verify(coupons).save(any());
        ReflectionTestUtils.setField(mission,"coupon",null);
        assertThat(granter.grant(user,mission,3)).isEqualTo(CultureMissionRewardGranter.GrantedReward.NONE);
    }
    @Test void ownedCouponIsNotInsertedAgainButGrantIsRecorded() {
        ReflectionTestUtils.setField(mission,"arCharacter",null);ReflectionTestUtils.setField(mission,"point",null);
        when(coupons.existsById(new AcquiredCouponId(10L,15L))).thenReturn(true);
        assertThat(granter.grant(user,mission,1).coupon()).isSameAs(coupon);
        verify(coupons,never()).save(any());
        var status=ArgumentCaptor.forClass(MissionRewardStatus.class);verify(statuses).save(status.capture());
        assertThat(status.getValue().isCouponRewardGranted()).isTrue();
    }
}
