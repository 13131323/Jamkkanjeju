package com.jamkkanjeju.server.domain.mypage.dto;

import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.onboarding.entity.OnboardingResult;
import com.jamkkanjeju.server.domain.onboarding.entity.UserExpectation;
import com.jamkkanjeju.server.domain.onboarding.entity.UserTransportation;
import com.jamkkanjeju.server.domain.onboarding.entity.UserTravelStyle;
import java.util.List;

/** 프로필 수정 화면에서 사용할 사용자 저장값과 여행 선택값이다. */
public record GetUserInfoResponse(
        String userType, String characterImgUrl, String nickname, List<String> expectations,
        String transportation, String travelStyle, int targetStepCount
) {
    /** 온보딩 결과와 현재 선택값을 변환하며 없는 단일 선택은 null로 유지한다. */
    public static GetUserInfoResponse of(User user, List<UserExpectation> expectations,
                                         UserTransportation transportation, UserTravelStyle travelStyle) {
        OnboardingResult result = user.getOnboardingResult();
        return new GetUserInfoResponse(result == null ? null : result.getUserType(),
                result == null ? null : result.getProfileImgUrl(), user.getNickname(),
                expectations.stream().map(selection -> selection.getExpectation().getExpectationType().name()).toList(),
                transportation == null ? null : transportation.getTransportation().getTransportationType().name(),
                travelStyle == null ? null : travelStyle.getTravelStyle().getTravelStyleType().name(), user.getTargetStep());
    }
}
