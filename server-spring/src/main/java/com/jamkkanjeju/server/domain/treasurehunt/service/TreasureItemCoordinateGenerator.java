package com.jamkkanjeju.server.domain.treasurehunt.service;

import static com.jamkkanjeju.server.domain.treasurehunt.service.TreasureMissionConstants.TREASURE_APPEAR_RADIUS_METER;
import static com.jamkkanjeju.server.domain.treasurehunt.service.TreasureMissionConstants.TREASURE_ITEM_COUNT;

import java.util.List;
import java.util.concurrent.ThreadLocalRandom;
import java.util.stream.IntStream;
import org.springframework.stereotype.Component;

/** 사용자 좌표 중심의 등장 반경 안에 새 보물 좌표를 생성한다. */
@Component
public class TreasureItemCoordinateGenerator {

    private static final double EARTH_RADIUS_METER = 6_371_000;

    /** 생성 개수 상수만큼 좌표를 만든다. 기존 진행도 이어하기에는 호출하지 않는다. */
    public List<Coordinate> generate(double latitude, double longitude) {
        return IntStream.range(0, TREASURE_ITEM_COUNT)
                .mapToObj(index -> randomCoordinate(latitude, longitude))
                .toList();
    }

    /** 무작위 거리·방향을 구면 좌표로 변환해 극점·날짜 변경선에서도 유효한 위도·경도를 만든다. */
    private Coordinate randomCoordinate(double latitude, double longitude) {
        ThreadLocalRandom random = ThreadLocalRandom.current();
        double distance = TREASURE_APPEAR_RADIUS_METER * Math.sqrt(random.nextDouble());
        double bearing = 2 * Math.PI * random.nextDouble();
        double angularDistance = distance / EARTH_RADIUS_METER;
        double originLatitude = Math.toRadians(latitude);
        double originLongitude = Math.toRadians(longitude);
        double sinLatitude = Math.sin(originLatitude) * Math.cos(angularDistance)
                + Math.cos(originLatitude) * Math.sin(angularDistance) * Math.cos(bearing);
        double targetLatitude = Math.asin(Math.clamp(sinLatitude, -1.0, 1.0));
        double targetLongitude = originLongitude + Math.atan2(
                Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(originLatitude),
                Math.cos(angularDistance) - Math.sin(originLatitude) * Math.sin(targetLatitude));
        double normalizedLongitude = ((Math.toDegrees(targetLongitude) + 180) % 360 + 360) % 360 - 180;
        return new Coordinate(Math.toDegrees(targetLatitude), normalizedLongitude);
    }

    /** 저장할 보물 한 개의 위도·경도이다. */
    public record Coordinate(double latitude, double longitude) {
    }
}
