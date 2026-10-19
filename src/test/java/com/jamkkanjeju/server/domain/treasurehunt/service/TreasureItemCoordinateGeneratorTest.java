package com.jamkkanjeju.server.domain.treasurehunt.service;

import static org.assertj.core.api.Assertions.*;
import static com.jamkkanjeju.server.domain.treasurehunt.support.TreasureMissionFixtures.distance;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

/** 특정 난수 대신 모든 생성 좌표가 지켜야 하는 개수·범위·거리를 검증한다. */
class TreasureItemCoordinateGeneratorTest {
    @ParameterizedTest
    @CsvSource({"33.3663,126.3577", "0,0", "90,180", "-90,-180", "0,179.9999", "0,-179.9999"})
    void 사용자_중심_100미터_안에_유효한_좌표_3개를_생성한다(double lat, double lng) {
        var generator = new TreasureItemCoordinateGenerator();
        for (int attempt = 0; attempt < 100; attempt++) {
            var coordinates = generator.generate(lat, lng);
            assertThat(coordinates).hasSize(3);
            coordinates.forEach(coordinate -> {
                assertThat(coordinate.latitude()).isBetween(-90.0, 90.0);
                assertThat(coordinate.longitude()).isBetween(-180.0, 180.0);
                assertThat(distance(lat, lng, coordinate.latitude(), coordinate.longitude())).isLessThanOrEqualTo(100.001);
            });
        }
    }
}
