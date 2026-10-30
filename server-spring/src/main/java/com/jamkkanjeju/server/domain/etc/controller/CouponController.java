package com.jamkkanjeju.server.domain.etc.controller;

import com.jamkkanjeju.server.domain.auth.security.AuthUser;
import com.jamkkanjeju.server.domain.etc.service.CouponService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Positive;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** 기타 도메인의 쿠폰 사용 API이다. */
@RestController
@RequestMapping("/api/v2/coupons")
@RequiredArgsConstructor
@Tag(name = "기타")
public class CouponController {
    private final CouponService couponService;

    /** 로그인 사용자의 쿠폰을 사용하고 본문 없는 성공 응답을 반환한다. */
    @Operation(summary = "쿠폰 사용 처리")
    @ApiResponse(responseCode = "204", description = "쿠폰 사용 완료")
    @PatchMapping("/{couponId}/use")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void useCoupon(@AuthenticationPrincipal AuthUser authUser, @Positive @PathVariable Long couponId) {
        couponService.useCoupon(authUser.userId(), couponId);
    }
}
