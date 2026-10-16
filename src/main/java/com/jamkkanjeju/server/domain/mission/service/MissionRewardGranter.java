package com.jamkkanjeju.server.domain.mission.service;

import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.mission.entity.Mission;
import com.jamkkanjeju.server.domain.mission.entity.MissionRewardStatus;
import com.jamkkanjeju.server.domain.mission.entity.MissionRewardStatusId;
import com.jamkkanjeju.server.domain.mission.repository.MissionRewardStatusRepository;
import com.jamkkanjeju.server.domain.home.entity.AcquiredCoupon;
import com.jamkkanjeju.server.domain.home.entity.AcquiredCouponId;
import com.jamkkanjeju.server.domain.home.entity.Coupon;
import com.jamkkanjeju.server.domain.home.repository.AcquiredCouponRepository;
import com.jamkkanjeju.server.domain.treasurehunt.entity.AcquiredArCharacter;
import com.jamkkanjeju.server.domain.treasurehunt.entity.ArCharacter;
import com.jamkkanjeju.server.domain.treasurehunt.repository.AcquiredArCharacterRepository;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/** 미션 보상을 도메인에서 전달한 한도만큼 지급하고, 같은 미션의 같은 보상을 다시 지급하지 않도록 지급 여부를 기록한다. */
@Component
@RequiredArgsConstructor
public class MissionRewardGranter {

    private final MissionRewardStatusRepository missionRewardStatusRepository;
    private final AcquiredArCharacterRepository acquiredArCharacterRepository;
    private final AcquiredCouponRepository acquiredCouponRepository;
    private final Clock clock;

    /**
     * 아직 받지 않은 보상을 AR 캐릭터, 포인트, 쿠폰 순서로 지급 한도만큼 지급하고 이번에 지급한 보상을 돌려준다.
     * 지급할 보상이 없으면 모든 항목이 null이다.
     */
    public GrantedReward grant(User user, Mission mission, ArCharacter arCharacter, Integer point,
                               Coupon coupon, int grantLimit) {
        Optional<MissionRewardStatus> savedStatus = missionRewardStatusRepository
                .findById(new MissionRewardStatusId(mission.getId(), user.getId()));

        List<RewardItem> candidates = candidates(arCharacter, point, coupon, savedStatus.orElse(null));
        int grantCount = Math.min(grantLimit, candidates.size());
        if (grantCount == 0) {
            return GrantedReward.NONE;
        }

        MissionRewardStatus rewardStatus = savedStatus.orElseGet(() -> MissionRewardStatus.builder()
                .user(user)
                .mission(mission)
                .build());
        ArCharacter grantedArCharacter = null;
        Integer grantedPoint = null;
        Coupon grantedCoupon = null;
        for (RewardItem item : candidates.subList(0, grantCount)) {
            switch (item) {
                case AR_CHARACTER -> {
                    grantedArCharacter = grantArCharacter(user, mission, arCharacter);
                    rewardStatus.grantArCharacterReward();
                }
                case POINT -> {
                    grantedPoint = point;
                    user.addPoint(grantedPoint);
                    rewardStatus.grantPointReward();
                }
                case COUPON -> {
                    grantedCoupon = grantCoupon(user, coupon);
                    rewardStatus.grantCouponReward();
                }
            }
        }
        // 지급 여부를 모두 반영한 뒤 저장해야 새 기록에도 지급 상태가 함께 저장된다.
        missionRewardStatusRepository.save(rewardStatus);
        return new GrantedReward(grantedArCharacter, grantedPoint, grantedCoupon);
    }

    /** 미션에 설정되어 있고 아직 지급하지 않은 보상 항목을 AR 캐릭터, 포인트, 쿠폰 순서로 고른다. */
    private List<RewardItem> candidates(ArCharacter arCharacter, Integer point, Coupon coupon,
                                        MissionRewardStatus rewardStatus) {
        List<RewardItem> candidates = new ArrayList<>();
        if (arCharacter != null
                && (rewardStatus == null || !rewardStatus.isArCharacterRewardGranted())) {
            candidates.add(RewardItem.AR_CHARACTER);
        }
        if (point != null
                && (rewardStatus == null || !rewardStatus.isPointRewardGranted())) {
            candidates.add(RewardItem.POINT);
        }
        if (coupon != null
                && (rewardStatus == null || !rewardStatus.isCouponRewardGranted())) {
            candidates.add(RewardItem.COUPON);
        }
        return candidates;
    }

    /** 미션의 AR 캐릭터를 사용자가 이 미션으로 획득한 기록으로 저장한다. */
    private ArCharacter grantArCharacter(User user, Mission mission, ArCharacter arCharacter) {
        acquiredArCharacterRepository.save(AcquiredArCharacter.builder()
                .arCharacter(arCharacter)
                .user(user)
                .mission(mission)
                .build());
        return arCharacter;
    }

    /** 미션의 쿠폰을 사용자 보유 쿠폰으로 저장한다. 이미 보유한 쿠폰이면 기록을 새로 만들지 않는다. */
    private Coupon grantCoupon(User user, Coupon coupon) {
        if (!acquiredCouponRepository.existsById(new AcquiredCouponId(coupon.getId(), user.getId()))) {
            acquiredCouponRepository.save(AcquiredCoupon.builder()
                    .coupon(coupon)
                    .user(user)
                    .acquiredAt(LocalDateTime.now(clock))
                    .build());
        }
        return coupon;
    }

    /** 공통 미션 보상 항목. 선언 순서가 지급 순서이다. */
    private enum RewardItem {
        AR_CHARACTER, POINT, COUPON
    }

    /** 이번 요청으로 지급한 보상. 지급하지 않은 항목은 null이다. */
    public record GrantedReward(ArCharacter arCharacter, Integer point, Coupon coupon) {

        public static final GrantedReward NONE = new GrantedReward(null, null, null);
    }
}
