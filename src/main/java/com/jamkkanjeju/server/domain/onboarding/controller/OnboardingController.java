package com.jamkkanjeju.server.domain.onboarding.controller;

import com.jamkkanjeju.server.domain.auth.security.AuthUser;
import com.jamkkanjeju.server.domain.onboarding.dto.CompleteOnboardingRequest;
import com.jamkkanjeju.server.domain.onboarding.dto.CompleteOnboardingResponse;
import com.jamkkanjeju.server.domain.onboarding.service.OnboardingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 사용자 온보딩 API 요청을 받아 서비스에 전달하는 컨트롤러이다. */
@Tag(name = "onboarding")
@RestController
@RequestMapping("/api/v2/users")
@RequiredArgsConstructor
public class OnboardingController {

    private final OnboardingService onboardingService;

    /** 로그인한 사용자의 온보딩을 완료하고 배정된 온보딩 결과를 반환한다. */
    @Operation(summary = "사용자 온보딩 완료")
    @PatchMapping("/me")
    public CompleteOnboardingResponse completeOnboarding(@AuthenticationPrincipal AuthUser authUser,
                                                         @Valid @RequestBody CompleteOnboardingRequest request) {
        return onboardingService.completeOnboarding(authUser.userId(), request);
    }
}
