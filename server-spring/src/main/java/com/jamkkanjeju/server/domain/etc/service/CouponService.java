package com.jamkkanjeju.server.domain.etc.service;

import com.jamkkanjeju.server.common.exception.BusinessException;
import com.jamkkanjeju.server.domain.etc.exception.EtcErrorCode;
import com.jamkkanjeju.server.domain.etc.repository.CouponRepository;
import com.jamkkanjeju.server.domain.home.entity.AcquiredCoupon;
import com.jamkkanjeju.server.domain.home.entity.AcquiredCouponId;
import com.jamkkanjeju.server.domain.home.repository.AcquiredCouponRepository;
import java.time.Clock;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 현재 사용자가 획득한 쿠폰의 사용 여부를 확인하고 사용 시각을 저장한다. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CouponService {
    private final CouponRepository couponRepository;
    private final AcquiredCouponRepository acquiredCouponRepository;
    private final Clock clock;

    /** 쿠폰·획득 여부와 기존 사용 상태를 순서대로 확인하여 한 번만 사용 처리한다. */
    @Transactional
    public void useCoupon(Long userId, Long couponId) {
        if (!couponRepository.existsById(couponId)) {
            throw new BusinessException(EtcErrorCode.COUPON_NOT_FOUND);
        }
        AcquiredCoupon acquiredCoupon = acquiredCouponRepository
                .findByIdForUpdate(new AcquiredCouponId(couponId, userId))
                .orElseThrow(() -> new BusinessException(EtcErrorCode.ACQUIRED_COUPON_NOT_FOUND));
        if (acquiredCoupon.getUsedAt() != null) {
            throw new BusinessException(EtcErrorCode.COUPON_ALREADY_USED);
        }
        acquiredCoupon.use(LocalDateTime.now(clock));
    }
}
