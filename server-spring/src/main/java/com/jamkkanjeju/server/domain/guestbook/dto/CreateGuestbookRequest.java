package com.jamkkanjeju.server.domain.guestbook.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.multipart.MultipartFile;

/** 방명록 유형별 위치와 방문 날짜·콘텐츠·선택 첨부 파일을 전달하는 multipart 요청이다. */
public record CreateGuestbookRequest(
        @NotNull @Pattern(regexp = "GENERAL|ROAD")
        @Schema(allowableValues = {"GENERAL", "ROAD"}) String guestbookType,
        @Positive Long locationId,
        @Size(max = 100) String locationAlias,
        @DecimalMin("-90.0") @DecimalMax("90.0") Double latitude,
        @DecimalMin("-180.0") @DecimalMax("180.0") Double longitude,
        @NotNull @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate visitedAt,
        MultipartFile imageFile,
        @Size(max = 500) String contentWriting,
        MultipartFile audioFile,
        @Size(max = 20) String audioTitle,
        @Size(max = 20) String contentWeather,
        @DecimalMin("-999.9") @DecimalMax("999.9") @Digits(integer = 3, fraction = 1)
        BigDecimal contentTemperatureCelsius,
        @Size(max = 20) String contentColorCode,
        @Positive Long missionId
) {

    /** 유형별 필수 위치가 존재하고 사용하지 않는 위치·미션 필드가 비어 있는지 확인한다. */
    @AssertTrue
    @JsonIgnore
    @Schema(hidden = true)
    public boolean isValidTypeFields() {
        if ("GENERAL".equals(guestbookType)) {
            return locationId != null && locationAlias == null && latitude == null && longitude == null;
        }
        if ("ROAD".equals(guestbookType)) {
            return locationAlias != null && latitude != null && longitude != null
                    && locationId == null && missionId == null;
        }
        return true;
    }

    /** 파일 미첨부는 허용하고 실제 첨부한 파일은 비어 있지 않은지 확인한다. */
    @AssertTrue
    @JsonIgnore
    @Schema(hidden = true)
    public boolean isValidAttachments() {
        return (imageFile == null || !imageFile.isEmpty()) && (audioFile == null || !audioFile.isEmpty());
    }
}
