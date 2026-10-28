package com.jamkkanjeju.server.domain.guestbook.dto;

import static com.jamkkanjeju.server.domain.guestbook.support.GuestbookFixtures.*;
import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.annotation.JsonIgnore;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/** 조건부 위치와 콘텐츠 길이·기온·좌표·파일 검증을 확인한다. */
class CreateGuestbookRequestTest {
    static ValidatorFactory factory;
    static Validator validator;
    @BeforeAll static void setup() { factory = Validation.buildDefaultValidatorFactory(); validator = factory.getValidator(); }
    @AfterAll static void close() { factory.close(); }

    @Test
    void 두유형의_빈콘텐츠와_경계값을_허용한다() {
        assertThat(validator.validate(request("GENERAL", null))).isEmpty();
        assertThat(validator.validate(request("ROAD", null))).isEmpty();
        assertThat(validator.validate(new CreateGuestbookRequest("ROAD", null, "가".repeat(100), -90.0, -180.0,
                DATE, null, "가".repeat(500), null, "가".repeat(20), "가".repeat(20), new BigDecimal("-999.9"), "가".repeat(20), null))).isEmpty();
        assertThat(validator.validate(new CreateGuestbookRequest("ROAD", null, "별칭", 90.0, 180.0,
                DATE, null, null, null, null, null, new BigDecimal("999.9"), null, null))).isEmpty();
    }

    @ParameterizedTest
    @ValueSource(strings = {"guestbookType", "locationId", "locationAlias", "latitude", "longitude", "visitedAt", "imageFile",
            "contentWriting", "audioFile", "audioTitle", "contentWeather", "contentTemperatureCelsius", "contentColorCode", "missionId"})
    void 필수값_길이_좌표_기온_파일의_잘못된값은_거절한다(String field) {
        CreateGuestbookRequest base = request("GENERAL", null);
        Map<String, Object> invalid = new HashMap<>();
        invalid.put("guestbookType", "INVALID"); invalid.put("locationId", -1L);
        invalid.put("locationAlias", "가".repeat(101)); invalid.put("latitude", Double.NaN);
        invalid.put("longitude", Double.POSITIVE_INFINITY); invalid.put("visitedAt", null);
        invalid.put("imageFile", file("imageFile", new byte[0])); invalid.put("audioFile", file("audioFile", new byte[0]));
        invalid.put("contentWriting", "가".repeat(501)); invalid.put("audioTitle", "가".repeat(21));
        invalid.put("contentWeather", "가".repeat(21)); invalid.put("contentTemperatureCelsius", new BigDecimal("1.23"));
        invalid.put("contentColorCode", "가".repeat(21)); invalid.put("missionId", 0L);
        assertThat(validator.validateProperty(base, field, new Class<?>[0])).isEmpty();
        Object[] values = {base.guestbookType(), base.locationId(), base.locationAlias(), base.latitude(), base.longitude(), base.visitedAt(),
                base.imageFile(), base.contentWriting(), base.audioFile(), base.audioTitle(), base.contentWeather(), base.contentTemperatureCelsius(), base.contentColorCode(), base.missionId()};
        java.lang.reflect.RecordComponent[] components = CreateGuestbookRequest.class.getRecordComponents();
        for (int i = 0; i < components.length; i++) if (components[i].getName().equals(field)) values[i] = invalid.get(field);
        try {
            CreateGuestbookRequest bad = CreateGuestbookRequest.class.getDeclaredConstructors()[0].newInstance(values) instanceof CreateGuestbookRequest value ? value : null;
            if (field.equals("imageFile") || field.equals("audioFile")) {
                assertThat(validator.validate(bad)).isNotEmpty();
            } else {
                assertThat(validator.validateProperty(bad, field)).isNotEmpty();
            }
        } catch (ReflectiveOperationException exception) { throw new AssertionError(exception); }
    }

    @Test
    void 유형별_누락과_미사용필드를_거절하고_검증메서드를_숨긴다() throws Exception {
        assertThat(validator.validate(new CreateGuestbookRequest("GENERAL", null, null, null, null, DATE, null, null, null, null, null, null, null, null))).isNotEmpty();
        assertThat(validator.validate(new CreateGuestbookRequest("ROAD", 39L, "별칭", 33.0, 126.0, DATE, null, null, null, null, null, null, null, 1L))).isNotEmpty();
        assertThat(validator.validate(new CreateGuestbookRequest("ROAD", null, null, null, null, DATE, null, null, null, null, null, null, null, null))).isNotEmpty();
        for (String method : new String[]{"isValidTypeFields", "isValidAttachments"}) {
            assertThat(CreateGuestbookRequest.class.getMethod(method).getAnnotation(JsonIgnore.class).value()).isTrue();
            assertThat(CreateGuestbookRequest.class.getMethod(method).getAnnotation(Schema.class).hidden()).isTrue();
        }
    }
}
