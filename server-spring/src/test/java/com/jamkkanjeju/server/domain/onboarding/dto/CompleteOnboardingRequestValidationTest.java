package com.jamkkanjeju.server.domain.onboarding.dto;

import static org.assertj.core.api.Assertions.assertThat;

import com.jamkkanjeju.server.domain.onboarding.entity.ExpectationType;
import com.jamkkanjeju.server.domain.onboarding.entity.TransportationType;
import com.jamkkanjeju.server.domain.onboarding.entity.TravelStyleType;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

class CompleteOnboardingRequestValidationTest {

    private static Validator validator;

    @BeforeAll
    static void setUpValidator() {
        validator = Validation.buildDefaultValidatorFactory().getValidator();
    }

    @Test
    void 모든_선택_필드가_없으면_나중에_할게요_요청으로_유효하다() {
        CompleteOnboardingRequest request = new CompleteOnboardingRequest(null, null, null);

        assertThat(request.isSkipped()).isTrue();
        assertThat(validator.validate(request)).isEmpty();
    }

    @Test
    void 세_필드가_모두_있으면_일반_완료_요청으로_유효하다() {
        CompleteOnboardingRequest request = new CompleteOnboardingRequest(
                List.of(ExpectationType.PHOTO, ExpectationType.CAFE),
                TransportationType.WALK,
                TravelStyleType.NEAR_DESTINATION);

        assertThat(request.isSkipped()).isFalse();
        assertThat(validator.validate(request)).isEmpty();
    }

    @Test
    void 세_필드_중_일부만_전달하면_거부한다() {
        List<CompleteOnboardingRequest> partialRequests = List.of(
                new CompleteOnboardingRequest(List.of(ExpectationType.PHOTO), null, null),
                new CompleteOnboardingRequest(null, TransportationType.BUS, null),
                new CompleteOnboardingRequest(null, null, TravelStyleType.RIGHT_HERE),
                new CompleteOnboardingRequest(List.of(ExpectationType.PHOTO), TransportationType.BUS, null),
                new CompleteOnboardingRequest(List.of(ExpectationType.PHOTO), null, TravelStyleType.RIGHT_HERE),
                new CompleteOnboardingRequest(null, TransportationType.BUS, TravelStyleType.RIGHT_HERE));

        for (CompleteOnboardingRequest request : partialRequests) {
            assertThat(request.isSkipped()).isFalse();
            assertThat(validator.validate(request)).isNotEmpty();
        }
    }

    @Test
    void 기대_항목이_빈_목록이면_거부한다() {
        CompleteOnboardingRequest request = new CompleteOnboardingRequest(
                List.of(), TransportationType.CAR, TravelStyleType.NEAR_AROUND);

        assertThat(validator.validate(request)).isNotEmpty();
    }

    @Test
    void 기대_항목에_null이_포함되면_거부한다() {
        CompleteOnboardingRequest request = new CompleteOnboardingRequest(
                Arrays.asList(ExpectationType.PHOTO, null), TransportationType.CAR, TravelStyleType.NEAR_AROUND);

        assertThat(validator.validate(request)).isNotEmpty();
    }

    @Test
    void 같은_기대_항목이_중복되면_거부한다() {
        CompleteOnboardingRequest request = new CompleteOnboardingRequest(
                List.of(ExpectationType.PHOTO, ExpectationType.PHOTO),
                TransportationType.CAR,
                TravelStyleType.NEAR_AROUND);

        assertThat(validator.validate(request)).isNotEmpty();
    }
}
