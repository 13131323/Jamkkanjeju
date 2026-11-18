package com.jamkkanjeju.server.domain.agent.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** CLI에서 승인한 전체 추가·삭제 계획이다. 배열의 데이터만 변경 대상으로 사용한다. */
public record SyncLocationsRequest(
        @NotBlank @Pattern(regexp = "^location-sync-[a-f0-9]{32}$") String requestId,
        @NotBlank @Size(max = 80) String storedSnapshotId,
        @NotBlank @Size(max = 80) String tourapiSnapshotId,
        @NotNull List<@NotNull @Valid AddedLocation> addLocations,
        @NotNull List<@NotNull @Valid DeletedLocation> deleteLocations
) {
    public record AddedLocation(
            @NotNull @Positive Long contentId,
            @NotBlank @Size(max = 100) String title,
            @NotBlank @Size(max = 255) String address,
            @NotBlank @Pattern(regexp = "^(축제·공연·행사|체험관광|음식|쇼핑|문화관광|레저스포츠)$") String category,
            @NotNull @PositiveOrZero Integer radius,
            @NotNull @DecimalMin("-90") @DecimalMax("90") Double latitude,
            @NotNull @DecimalMin("-180") @DecimalMax("180") Double longitude
    ) {
        public AddedLocation {
            title = title == null ? null : title.strip();
            address = address == null ? null : address.strip();
        }

        @AssertTrue @JsonIgnore @Schema(hidden = true)
        public boolean isFiniteCoordinates() {
            return (latitude == null || Double.isFinite(latitude)) && (longitude == null || Double.isFinite(longitude));
        }
    }

    public record DeletedLocation(@NotNull @Positive Long locationId, @NotNull @Positive Long contentId) {}

    @AssertTrue @JsonIgnore @Schema(hidden = true)
    public boolean isUnambiguousPlan() {
        if (addLocations == null || deleteLocations == null) return true;
        Set<Long> contentIds = new HashSet<>();
        Set<Long> locationIds = new HashSet<>();
        for (AddedLocation row : addLocations) {
            if (row == null || row.contentId() == null) continue;
            if (!contentIds.add(row.contentId())) return false;
        }
        for (DeletedLocation row : deleteLocations) {
            if (row == null) continue;
            if (row.contentId() != null && !contentIds.add(row.contentId())) return false;
            if (row.locationId() != null && !locationIds.add(row.locationId())) return false;
        }
        return true;
    }
}
