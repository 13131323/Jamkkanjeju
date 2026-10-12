package com.jamkkanjeju.server.domain.onboarding.support;

import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.onboarding.entity.Expectation;
import com.jamkkanjeju.server.domain.onboarding.entity.ExpectationType;
import com.jamkkanjeju.server.domain.onboarding.entity.OnboardingResult;
import com.jamkkanjeju.server.domain.onboarding.entity.Transportation;
import com.jamkkanjeju.server.domain.onboarding.entity.TransportationType;
import com.jamkkanjeju.server.domain.onboarding.entity.TravelStyle;
import com.jamkkanjeju.server.domain.onboarding.entity.TravelStyleType;
import com.jamkkanjeju.server.domain.onboarding.entity.UserExpectation;
import java.util.List;

/** 온보딩 단위 테스트에서 공통으로 쓰는 기준 데이터·온보딩 결과 생성 도우미 */
public final class OnboardingFixtures {

    public static final String DEFAULT_USER_TYPE = "여행자";

    private OnboardingFixtures() {
    }

    /** 기준 데이터 ID는 enum 순서 + 1로 고정한다. (V2 초기 데이터와 같은 순서) */
    public static Expectation expectation(ExpectationType type) {
        return Expectation.builder().id((long) type.ordinal() + 1).expectationType(type).build();
    }

    public static List<Expectation> expectations(List<ExpectationType> types) {
        return types.stream().map(OnboardingFixtures::expectation).toList();
    }

    public static Transportation transportation(TransportationType type) {
        return Transportation.builder().id((long) type.ordinal() + 1).transportationType(type).build();
    }

    public static TravelStyle travelStyle(TravelStyleType type) {
        return TravelStyle.builder().id((long) type.ordinal() + 1).travelStyleType(type).build();
    }

    public static UserExpectation userExpectation(User user, ExpectationType type) {
        return UserExpectation.builder().user(user).expectation(expectation(type)).build();
    }

    public static OnboardingResult onboardingResult(Long id, String userType) {
        return OnboardingResult.builder()
                .id(id)
                .userType(userType)
                .typeDescription(userType + " 설명")
                .hashtags(List.of("#" + userType, "#제주"))
                .profileImgUrl("https://example.com/" + id + ".png")
                .build();
    }

    public static OnboardingResult defaultResult() {
        return onboardingResult(7L, DEFAULT_USER_TYPE);
    }
}
