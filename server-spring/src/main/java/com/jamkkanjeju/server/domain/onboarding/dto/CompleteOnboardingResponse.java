package com.jamkkanjeju.server.domain.onboarding.dto;

import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.onboarding.entity.OnboardingResult;
import java.util.List;

/** 온보딩 완료 후 사용자의 온보딩 상태와 배정된 결과를 전달하는 응답이다. */
public record CompleteOnboardingResponse(UserInfo user) {

    /** 사용자 엔티티로 온보딩 완료 응답을 만든다. */
    public static CompleteOnboardingResponse from(User user) {
        return new CompleteOnboardingResponse(UserInfo.from(user));  // record에 의해 자동으로 만들어진 생성자를 사용.
    }

    /** 사용자의 온보딩 완료 여부와 온보딩 결과를 담는 응답 항목이다. */
    public record UserInfo(
            Long id,
            boolean onboardingCompleted,
            OnboardingResultInfo onboardingResult
    ) {

        /** 사용자 엔티티로 사용자 응답 항목을 만든다. */
        public static UserInfo from(User user) {
            OnboardingResult onboardingResult = user.getOnboardingResult();
            return new UserInfo(
                    user.getId(),
                    onboardingResult != null,
                    onboardingResult != null ? OnboardingResultInfo.from(onboardingResult) : null
            );
        }
    }

    /** 사용자에게 배정된 온보딩 결과(여행자 유형)를 담는 응답 항목이다. */
    public record OnboardingResultInfo(
            Long id,
            String userType,
            String typeDescription,
            List<String> hashtags,
            String profileImageUrl
    ) {

        /** 온보딩 결과 엔티티로 온보딩 결과 응답 항목을 만든다. */
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
