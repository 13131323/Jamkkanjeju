package com.jamkkanjeju.server.domain.agent.dto;

import static org.assertj.core.api.Assertions.*;
import jakarta.validation.Validation;
import jakarta.validation.ValidatorFactory;
import java.util.List;
import org.junit.jupiter.api.*;

/** 실제 DB에 닿기 전에 승인 계획의 형식과 대상 중복을 거부한다. */
class SyncLocationsRequestTest {
    static ValidatorFactory factory = Validation.buildDefaultValidatorFactory();
    static final String ID = "location-sync-11111111111111111111111111111111";
    @AfterAll static void close() { factory.close(); }

    private SyncLocationsRequest.AddedLocation add(long contentId, double latitude, String category) {
        return new SyncLocationsRequest.AddedLocation(contentId, " 장소 ", " 제주시 ", category, 100, latitude, 126.5);
    }
    private SyncLocationsRequest request(List<SyncLocationsRequest.AddedLocation> add, List<SyncLocationsRequest.DeletedLocation> delete) {
        return new SyncLocationsRequest(ID, "db-example", "tourapi-example", add, delete);
    }
    @Test void normalizesTextAndAcceptsAnExplicitPlan() {
        var row = add(2, 33.5, "음식");
        assertThat(row.title()).isEqualTo("장소");
        assertThat(row.address()).isEqualTo("제주시");
        assertThat(factory.getValidator().validate(request(List.of(row), List.of(new SyncLocationsRequest.DeletedLocation(1L, 1L))))).isEmpty();
    }
    @Test void invalidCoordinateAndCategoryAreRejected() {
        assertThat(factory.getValidator().validate(request(List.of(add(2, Double.NaN, "음식")), List.of()))).isNotEmpty();
        assertThat(factory.getValidator().validate(request(List.of(add(2, 91, "음식")), List.of()))).isNotEmpty();
        assertThat(factory.getValidator().validate(request(List.of(add(2, 33.5, "미지원")), List.of()))).isNotEmpty();
    }
    @Test void duplicateAndOverlappingTargetsAreRejected() {
        assertThat(factory.getValidator().validate(request(List.of(add(2, 33.5, "음식"), add(2, 33.5, "음식")), List.of()))).isNotEmpty();
        assertThat(factory.getValidator().validate(request(List.of(add(2, 33.5, "음식")), List.of(new SyncLocationsRequest.DeletedLocation(1L, 2L))))).isNotEmpty();
        assertThat(factory.getValidator().validate(request(List.of(), List.of(new SyncLocationsRequest.DeletedLocation(1L, 2L), new SyncLocationsRequest.DeletedLocation(1L, 3L))))).isNotEmpty();
    }
    @Test void missingAndInternalRequestIdsAreRejected() {
        assertThat(factory.getValidator().validate(new SyncLocationsRequest("__coordinator__", "db", "tour", List.of(), List.of()))).isNotEmpty();
        assertThat(factory.getValidator().validate(new SyncLocationsRequest(ID, " ", "tour", null, List.of()))).isNotEmpty();
    }
}
