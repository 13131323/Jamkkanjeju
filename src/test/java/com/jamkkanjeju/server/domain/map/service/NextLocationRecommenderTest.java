package com.jamkkanjeju.server.domain.map.service;

import static com.jamkkanjeju.server.domain.home.support.HomeFixtures.location;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.jamkkanjeju.server.domain.map.repository.LocationRepository;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Sort;

/** 실제 거리 계산으로 최근접 선택과 동률·빈 후보를 검증한다. */
class NextLocationRecommenderTest {
    @Test void completedLocationIsExcludedBeforeChoosingNearest() {
        when(repository.findAll(Sort.by("id"))).thenReturn(List.of(
                location(1L,"완료 장소",0,0), location(2L,"다음 장소",0,1)));
        assertThat(recommender.recommend(0,0,1L).orElseThrow().location().getId()).isEqualTo(2L);
    }
    @Test void onlyExcludedLocationReturnsEmpty() {
        when(repository.findAll(Sort.by("id"))).thenReturn(List.of(location(1L,"완료 장소",0,0)));
        assertThat(recommender.recommend(0,0,1L)).isEmpty();
    }
    final LocationRepository repository=mock(LocationRepository.class);
    final NextLocationRecommender recommender=new NextLocationRecommender(repository,new TravelEstimator());
    @Test void nearestIsChosenEvenWhenNotFirstAndDistanceIsInteger() {
        when(repository.findAll(Sort.by("id"))).thenReturn(List.of(location(1L,"먼 곳",20,20),location(2L,"가까운 곳",0,1)));
        var result=recommender.recommend(0,0).orElseThrow();
        assertThat(result.location().getId()).isEqualTo(2L);
        assertThat(result.distanceMeter()).isEqualTo(111195);
    }
    @Test void equalDistancesChooseSmallestId() {
        when(repository.findAll(Sort.by("id"))).thenReturn(List.of(location(1L,"첫 장소",0,1),location(2L,"둘째 장소",0,-1)));
        assertThat(recommender.recommend(0,0).orElseThrow().location().getId()).isEqualTo(1L);
        verify(repository).findAll(Sort.by("id"));
    }
    @Test void changedCoordinatesChangeRecommendation() {
        when(repository.findAll(Sort.by("id"))).thenReturn(List.of(location(1L,"첫 장소",0,1),location(2L,"둘째 장소",0,-1)));
        assertThat(recommender.recommend(0,1).orElseThrow().location().getId()).isEqualTo(1L);
        assertThat(recommender.recommend(0,-1).orElseThrow().location().getId()).isEqualTo(2L);
    }
    @Test void noLocationsReturnsEmpty() {
        when(repository.findAll(Sort.by("id"))).thenReturn(List.of());
        assertThat(recommender.recommend(0,0)).isEmpty();
    }
}
