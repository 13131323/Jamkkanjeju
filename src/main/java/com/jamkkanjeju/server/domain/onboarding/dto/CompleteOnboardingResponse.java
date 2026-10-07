package com.jamkkanjeju.server.domain.onboarding.dto;

import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.onboarding.entity.OnboardingResult;
import java.util.List;

public record CompleteOnboardingResponse(UserInfo user) {

    public static CompleteOnboardingResponse from(User user) {
        return new CompleteOnboardingResponse(UserInfo.from(user));  // record에 의해 자동으로 만들어진 생성자를 사용.
    }

    public record UserInfo(
            Long id,
            boolean onboardingCompleted,
            OnboardingResultInfo onboardingResult
    ) {

        public static UserInfo from(User user) {
            OnboardingResult onboardingResult = user.getOnboardingResult();
            return new UserInfo(
                    user.getId(),
                    onboardingResult != null,
                    onboardingResult != null ? OnboardingResultInfo.from(onboardingResult) : null
            );
        }
    }

    public record OnboardingResultInfo(
            Long id,
            String userType,
            String typeDescription,
            List<String> hashtags,
            String profileImageUrl
    ) {

        public static OnboardingResultInfo from(OnboardingResult onboardingResult) {
            return new OnboardingResultInfo(
                    onboardingResult.getId(),
                    onboardingResult.getUserType(),
                    onboardingResult.getTypeDescription(),
                    List.copyOf(onboardingResult.getHashtags()),
                    onboardingResult.getProfileImgUrl()
            );
        }
    }
}
