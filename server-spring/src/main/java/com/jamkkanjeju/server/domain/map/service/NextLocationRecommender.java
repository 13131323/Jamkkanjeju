package com.jamkkanjeju.server.domain.map.service;

import com.jamkkanjeju.server.domain.map.entity.Location;
import com.jamkkanjeju.server.domain.map.repository.LocationRepository;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Component;

/** 미션을 완료한 사용자에게 다음에 방문할 장소를 추천한다. 미션 종류와 관계없이 사용자 좌표만으로 추천한다. */
@Component
@RequiredArgsConstructor
public class NextLocationRecommender {

    private final LocationRepository locationRepository;
    private final TravelEstimator travelEstimator;

    /** 요청 위치에서 직선거리가 가장 가까운 장소를 추천한다. 거리가 같으면 ID가 작은 장소이고, 장소가 없으면 빈 값이다. */
    // TODO: 추후 사용자 개인화된 추천 로직을 적용한다.
    public Optional<RecommendedLocation> recommend(double latitude, double longitude) {
        return recommend(latitude, longitude, null);
    }

    /** 지정 장소를 제외하고 가장 가까운 다음 장소를 추천한다. 제외 ID가 null이면 모든 장소를 비교한다. */
    // TODO: 추후 사용자 개인화된 추천 로직을 적용한다.
    public Optional<RecommendedLocation> recommend(double latitude, double longitude, Long excludedLocationId) {
        Location nearest = null;
        double nearestDistance = Double.MAX_VALUE;
        // ID 오름차순으로 비교하므로 거리가 같으면 먼저 나온(ID가 작은) 장소가 남는다.
        for (Location location : locationRepository.findAll(Sort.by("id"))) {
            if (excludedLocationId != null && excludedLocationId.equals(location.getId())) {
                continue;
            }
            double distance = travelEstimator.distanceMeter(
                    latitude, longitude, location.getLatitude(), location.getLongitude());
            if (distance < nearestDistance) {
                nearest = location;
                nearestDistance = distance;
            }
        }
        if (nearest == null) {
            return Optional.empty();
        }
        return Optional.of(new RecommendedLocation(
                nearest, travelEstimator.estimate(latitude, longitude, nearest).distanceMeter()));
    }

    /** 추천한 장소와 요청 위치에서 그 장소까지의 직선거리(m, 정수). */
    public record RecommendedLocation(Location location, int distanceMeter) {
    }
}
