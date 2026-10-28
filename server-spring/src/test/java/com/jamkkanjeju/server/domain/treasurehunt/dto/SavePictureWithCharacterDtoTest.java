package com.jamkkanjeju.server.domain.treasurehunt.dto;

import static org.assertj.core.api.Assertions.*;
import static com.jamkkanjeju.server.domain.treasurehunt.support.PictureFixtures.*;

import jakarta.validation.Validation;
import org.junit.jupiter.api.Test;

/** 파일 필수 검증과 촬영 시각 없이 파일 하나만 받는 요청 계약을 검증한다. */
class SavePictureWithCharacterDtoTest {
    @Test
    void 요청은_필수사진_한개만_받는다() {
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            assertThat(factory.getValidator().validate(new SavePictureWithCharacterRequest(null))).hasSize(1);
            var file = picture(image("PNG"));
            var request = new SavePictureWithCharacterRequest(file);
            assertThat(factory.getValidator().validate(request)).isEmpty();
            assertThat(request.picture()).isSameAs(file);
            assertThat(SavePictureWithCharacterRequest.class.getRecordComponents())
                    .extracting(java.lang.reflect.RecordComponent::getName).containsExactly("picture");
        }
    }
}
