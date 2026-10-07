package com.jamkkanjeju.server.domain.onboarding.controller;

import com.jamkkanjeju.server.domain.auth.security.AuthUser;
import com.jamkkanjeju.server.domain.onboarding.dto.CompleteOnboardingRequest;
import com.jamkkanjeju.server.domain.onboarding.dto.CompleteOnboardingResponse;
import com.jamkkanjeju.server.domain.onboarding.service.OnboardingService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v2/users")
@RequiredArgsConstructor
public class OnboardingController {

    private final OnboardingService onboardingService;

    @PatchMapping("/me")
    public CompleteOnboardingResponse completeOnboarding(@AuthenticationPrincipal AuthUser authUser,
                                                         @Valid @RequestBody CompleteOnboardingRequest request) {
        return onboardingService.completeOnboarding(authUser.userId(), request);
    }
}
