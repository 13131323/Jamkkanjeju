package com.jamkkanjeju.server.domain.onboarding.dto;

import com.jamkkanjeju.server.domain.onboarding.entity.ExpectationType;
import com.jamkkanjeju.server.domain.onboarding.entity.TransportationType;
import com.jamkkanjeju.server.domain.onboarding.entity.TravelStyleType;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.HashSet;
import java.util.List;

/**
 * 온보딩 완료 요청. 빈 객체 {@code {}}는 "나중에 할게요" 요청이다.
 * 허용되지 않은 enum 값은 JSON 변환 단계에서 실패해 INVALID_REQUEST로 응답된다.
 */
public record CompleteOnboardingRequest(
        @Size(min = 1) List<@NotNull ExpectationType> expectations,
        TransportationType transportation,
        TravelStyleType travelStyle
) {

    /** 선택 필드가 하나도 없으면 "나중에 할게요" 요청이다. */
    public boolean isSkipped() {
        return expectations == null && transportation == null && travelStyle == null;
    }

    /** 일부 필드만 전달할 수 없다. 모두 없거나 모두 있어야 한다. */
    @AssertTrue
    boolean isAllOrNothing() {
        return isSkipped() || (expectations != null && transportation != null && travelStyle != null);
    }

    /** 여행 기대 항목은 중복될 수 없다. */
    @AssertTrue
    boolean isExpectationsDistinct() {
        return expectations == null || new HashSet<>(expectations).size() == expectations.size();
    }
}
