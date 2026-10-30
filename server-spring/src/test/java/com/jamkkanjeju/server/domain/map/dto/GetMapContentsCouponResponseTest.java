package com.jamkkanjeju.server.domain.map.dto;

import static com.jamkkanjeju.server.domain.map.support.MapModalFixtures.location;
import static com.jamkkanjeju.server.domain.map.support.MapModalFixtures.user;
import static com.jamkkanjeju.server.domain.map.support.MapModalFixtures.TIME;
import static org.assertj.core.api.Assertions.assertThat;

import com.jamkkanjeju.server.domain.home.entity.Coupon;
import com.jamkkanjeju.server.domain.home.entity.AcquiredCoupon;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/** 수령 쿠폰 응답이 쿠폰 자체의 ID·금액·주소를 유지하는지 검증한다. */
class GetMapContentsCouponResponseTest {
    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void 쿠폰의_ID와_금액_사용처_주소_사용시각을_반환한다(boolean used) {
        Coupon coupon = Coupon.builder().id(123L).couponPrice(1000).location(location(45L, 987L)).build();
        AcquiredCoupon acquired = AcquiredCoupon.builder().coupon(coupon).user(user(1L, "coupon@example.com"))
                .acquiredAt(TIME).usedAt(used ? TIME : null).build();
        assertThat(GetMapContentsResponse.ReceivedCoupon.from(acquired))
                .isEqualTo(new GetMapContentsResponse.ReceivedCoupon(123L, 1000, "제주 테스트 주소", used ? TIME : null));
    }
}
