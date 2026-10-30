package com.jamkkanjeju.server.domain.mypage.dto;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.jamkkanjeju.server.domain.onboarding.entity.ExpectationType;
import com.jamkkanjeju.server.domain.onboarding.entity.TransportationType;
import com.jamkkanjeju.server.domain.onboarding.entity.TravelStyleType;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** 생략된 필드와 명시적으로 해제한 필드를 구분하는 사용자 정보 부분 변경 요청이다. */
public record UpdateUserInfoRequest(
        @Size(min = 1, max = 20) String nickname,
        List<ExpectationType> expectations,
        @Schema(nullable = true) TransportationType transportation,
        @Schema(nullable = true) TravelStyleType travelStyle,
        @Min(1) @Max(100000) Integer targetStepCount,
        @JsonIgnore @Schema(hidden = true) Set<String> providedFields
) {
    private static final Set<String> ALLOWED_FIELDS = Set.of(
            "nickname", "expectations", "transportation", "travelStyle", "targetStepCount");

    /** 닉네임을 정규화하고 요청에 포함된 필드 목록을 보존한다. */
    public UpdateUserInfoRequest {
        nickname = nickname == null ? null : nickname.strip();
        expectations = expectations == null ? null : List.copyOf(expectations);
        providedFields = Set.copyOf(providedFields);
    }

    /** JSON 객체의 키를 보존하며 필드별 타입과 명시적인 null 허용 여부를 확인한다. */
    @JsonCreator(mode = JsonCreator.Mode.DELEGATING)
    public static UpdateUserInfoRequest from(Map<String, Object> fields) {
        if (fields == null || !ALLOWED_FIELDS.containsAll(fields.keySet())) {
            throw new IllegalArgumentException("허용되지 않은 사용자 정보 변경 필드입니다.");
        }
        for (String field : List.of("nickname", "expectations", "targetStepCount")) {
            if (fields.containsKey(field) && fields.get(field) == null) {
                throw new IllegalArgumentException(field + "에는 null을 사용할 수 없습니다.");
            }
        }
        Object rawExpectations = fields.get("expectations");
        if (rawExpectations != null && !(rawExpectations instanceof List<?>)) {
            throw new IllegalArgumentException("expectations는 배열이어야 합니다.");
        }
        List<ExpectationType> expectations = rawExpectations == null ? null
                : ((List<?>) rawExpectations).stream()
                        .map(value -> ExpectationType.valueOf(stringValue(value))).toList();
        Object rawTarget = fields.get("targetStepCount");
        if (rawTarget != null && !(rawTarget instanceof Integer)) {
            throw new IllegalArgumentException("targetStepCount는 정수여야 합니다.");
        }
        return new UpdateUserInfoRequest(
                fields.get("nickname") == null ? null : stringValue(fields.get("nickname")),
                expectations,
                fields.get("transportation") == null ? null
                        : TransportationType.valueOf(stringValue(fields.get("transportation"))),
                fields.get("travelStyle") == null ? null
                        : TravelStyleType.valueOf(stringValue(fields.get("travelStyle"))),
                (Integer) rawTarget, fields.keySet());
    }

    /** 숫자·배열 등을 문자열로 암묵적으로 변환하지 않고 요청 오류로 처리한다. */
    private static String stringValue(Object value) {
        if (!(value instanceof String text)) {
            throw new IllegalArgumentException("문자열 형식이 아닙니다.");
        }
        return text;
    }

    /** 해당 필드가 요청에 실제로 포함됐는지 확인한다. */
    @JsonIgnore
    @Schema(hidden = true)
    public boolean hasField(String name) {
        return providedFields.contains(name);
    }

    /** 기대 항목은 빈 목록을 허용하지만 중복 선택은 허용하지 않는다. */
    @AssertTrue
    @JsonIgnore
    @Schema(hidden = true)
    public boolean isExpectationsDistinct() {
        return expectations == null || new HashSet<>(expectations).size() == expectations.size();
    }
}
