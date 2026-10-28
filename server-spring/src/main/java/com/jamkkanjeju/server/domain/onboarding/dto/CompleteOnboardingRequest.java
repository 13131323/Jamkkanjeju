package com.jamkkanjeju.server.domain.onboarding.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.jamkkanjeju.server.domain.onboarding.entity.ExpectationType;
import com.jamkkanjeju.server.domain.onboarding.entity.TransportationType;
import com.jamkkanjeju.server.domain.onboarding.entity.TravelStyleType;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.HashSet;
import java.util.List;

// 빈 객체 {}는 "나중에 할게요" 요청이고, 허용되지 않은 enum 값은 JSON 변환 단계에서 실패해 INVALID_REQUEST로 응답된다.
/** 사용자가 선택한 온보딩 값(여행 기대 항목·이동 수단·여행 방식)을 전달하는 요청이다. */
public record CompleteOnboardingRequest(
        @Size(min = 1) List<@NotNull ExpectationType> expectations,
        TransportationType transportation,
        TravelStyleType travelStyle
) {

    /** "나중에 할게요" 요청인지 판정한다. */
    @JsonIgnore
    @Schema(hidden = true)
    public boolean isSkipped() {
        return expectations == null && transportation == null && travelStyle == null;
    }

    /** 선택값이 모두 비어 있거나 모두 채워져 있는지 검증한다. */
    @AssertTrue
    boolean isAllOrNothing() {
        return isSkipped() || (expectations != null && transportation != null && travelStyle != null);
    }

    /** 여행 기대 항목에 중복이 없는지 검증한다. */
    @AssertTrue
    boolean isExpectationsDistinct() {
        return expectations == null || new HashSet<>(expectations).size() == expectations.size();
    }
}
