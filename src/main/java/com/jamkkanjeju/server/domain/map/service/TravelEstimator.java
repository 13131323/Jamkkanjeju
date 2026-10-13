package com.jamkkanjeju.server.domain.map.service;

import com.jamkkanjeju.server.domain.map.entity.Location;
import org.springframework.stereotype.Component;

/** 요청 위치에서 장소까지의 거리와 예상 소요 시간을 추정한다. */
@Component
public class TravelEstimator {

    private static final double EARTH_RADIUS_METER = 6_371_000;

    /** 직선거리 100m를 1분 20초(80초)에 걷는 기준 */
    private static final double MINUTES_PER_METER = 80.0 / 100 / 60;

    /** 요청 위치에서 장소까지의 거리(m)와 예상 소요 시간(분)을 응답에 쓸 값으로 구한다. */
    public TravelEstimate estimate(double latitude, double longitude, Location location) {
        if (location == null) {
            return TravelEstimate.UNKNOWN;
        }
        double distanceMeter = distanceMeter(latitude, longitude, location.getLatitude(), location.getLongitude());
        return new TravelEstimate(
                (int) Math.round(distanceMeter),
                (int) Math.round(durationMinutes(distanceMeter)));
    }

    /** 두 좌표 사이의 거리(m)를 구한다. */
    // TODO: 추후 확정된 거리 계산 방식으로 현재 직선거리 계산 로직을 교체한다.
    public double distanceMeter(double fromLatitude, double fromLongitude, double toLatitude, double toLongitude) {
        double latitudeDelta = Math.toRadians(toLatitude - fromLatitude);
        double longitudeDelta = Math.toRadians(toLongitude - fromLongitude);
        double a = Math.pow(Math.sin(latitudeDelta / 2), 2)
                + Math.cos(Math.toRadians(fromLatitude)) * Math.cos(Math.toRadians(toLatitude))
                * Math.pow(Math.sin(longitudeDelta / 2), 2);
        return 2 * EARTH_RADIUS_METER * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    /** 주어진 거리(m)를 걸어서 이동할 때의 예상 소요 시간(분)을 구한다. */
    // TODO: 추후 확정된 소요 시간 계산 방식으로 현재 직선거리 기반 도보 시간 추정 로직을 교체한다.
    public double durationMinutes(double distanceMeter) {
        return distanceMeter * MINUTES_PER_METER;
    }

    /** 응답에 쓰는 거리와 예상 소요 시간. 장소가 없어 구할 수 없으면 {@link #UNKNOWN}이다. */
    public record TravelEstimate(Integer distanceMeter, Integer durationMinutes) {

        public static final TravelEstimate UNKNOWN = new TravelEstimate(null, null);
    }
}
