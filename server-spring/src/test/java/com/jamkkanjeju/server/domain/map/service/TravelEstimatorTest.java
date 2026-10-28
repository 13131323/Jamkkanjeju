package com.jamkkanjeju.server.domain.map.service;

import static com.jamkkanjeju.server.domain.home.support.HomeFixtures.location;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import com.jamkkanjeju.server.domain.map.service.TravelEstimator.TravelEstimate;
import org.junit.jupiter.api.Test;

class TravelEstimatorTest {

    /** 반지름 6,371km 구에서 중심각 1도에 해당하는 호의 길이(m) = 2π × 6,371,000 / 360 */
    private static final double ONE_DEGREE_METER = 111_194.926_644_558_73;

    private final TravelEstimator travelEstimator = new TravelEstimator();

    @Test
    void 같은_좌표_사이의_거리와_시간은_0이다() {
        assertThat(travelEstimator.distanceMeter(33.5, 126.5, 33.5, 126.5)).isZero();
        assertThat(travelEstimator.estimate(33.5, 126.5, location(1L, "같은 곳", 33.5, 126.5)))
                .isEqualTo(new TravelEstimate(0, 0));
    }

    @Test
    void 기준_좌표의_직선거리가_기대값과_일치한다() {
        assertThat(travelEstimator.distanceMeter(0, 0, 0, 1)).isCloseTo(ONE_DEGREE_METER, within(0.01));
        assertThat(travelEstimator.distanceMeter(0, 0, 1, 0)).isCloseTo(ONE_DEGREE_METER, within(0.01));
    }

    @Test
    void 출발지와_목적지를_바꿔도_거리가_같다() {
        double forward = travelEstimator.distanceMeter(33.5572, 126.7591, 33.3663, 126.3577);
        double backward = travelEstimator.distanceMeter(33.3663, 126.3577, 33.5572, 126.7591);

        assertThat(forward).isCloseTo(backward, within(1e-6));
    }

    @Test
    void 직선_100m는_80초_300m는_4분으로_계산한다() {
        assertThat(travelEstimator.durationMinutes(100)).isCloseTo(80.0 / 60, within(1e-9));
        assertThat(travelEstimator.durationMinutes(300)).isCloseTo(4.0, within(1e-9));
    }

    @Test
    void 거리와_시간을_각각_반올림한_정수로_구성한다() {
        // 적도에서 경도 0.0038도 = 422.54m → 423m, 422.54m × 80 / 100 / 60 = 5.63분 → 6분
        assertThat(travelEstimator.estimate(0, 0, location(1L, "반올림 올림", 0, 0.0038)))
                .isEqualTo(new TravelEstimate(423, 6));
        // 적도에서 경도 0.001도 = 111.19m → 111m, 1.48분 → 1분
        assertThat(travelEstimator.estimate(0, 0, location(2L, "반올림 내림", 0, 0.001)))
                .isEqualTo(new TravelEstimate(111, 1));
    }

    @Test
    void 장소가_없으면_거리와_시간_모두_null이다() {
        TravelEstimate estimate = travelEstimator.estimate(33.5, 126.5, null);

        assertThat(estimate.distanceMeter()).isNull();
        assertThat(estimate.durationMinutes()).isNull();
    }
}
