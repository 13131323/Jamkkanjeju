package com.jamkkanjeju.server.domain.home.service;

import static com.jamkkanjeju.server.domain.home.support.HomeFixtures.cooperativeMission;
import static com.jamkkanjeju.server.domain.home.support.HomeFixtures.cultureMission;
import static com.jamkkanjeju.server.domain.home.support.HomeFixtures.location;
import static com.jamkkanjeju.server.domain.home.support.HomeFixtures.treasureMission;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import com.jamkkanjeju.server.domain.cooperativemission.entity.CooperativeMission;
import com.jamkkanjeju.server.domain.cooperativemission.repository.CooperativeMissionRepository;
import com.jamkkanjeju.server.domain.culturemission.repository.CultureMissionRepository;
import com.jamkkanjeju.server.domain.home.dto.GetHomeResponse.MissionRecommendInfo;
import com.jamkkanjeju.server.domain.map.entity.Location;
import com.jamkkanjeju.server.domain.map.service.TravelEstimator;
import com.jamkkanjeju.server.domain.map.service.TravelEstimator.TravelEstimate;
import com.jamkkanjeju.server.domain.mission.entity.MissionActivationStatus;
import com.jamkkanjeju.server.domain.treasurehunt.entity.TreasureMission;
import com.jamkkanjeju.server.domain.treasurehunt.repository.TreasureMissionRepository;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class MissionRecommenderTest {

    private static final double LAT = 33.5;
    private static final double LNG = 126.5;

    @Mock
    private CultureMissionRepository cultureMissionRepository;
    @Mock
    private TreasureMissionRepository treasureMissionRepository;
    @Mock
    private CooperativeMissionRepository cooperativeMissionRepository;
    @Mock
    private TravelEstimator travelEstimator;

    private MissionRecommender missionRecommender;

    @BeforeEach
    void setUp() {
        missionRecommender = new MissionRecommender(cultureMissionRepository, treasureMissionRepository,
                cooperativeMissionRepository, travelEstimator);
    }

    @Test
    void 후보가_있으면_문화_협동_보물찾기를_각각_한_건씩_추천한다() {
        TreasureMission treasure = treasureMission(11L, location(1L, "보물 장소", 33.51, 126.5), 3);
        CooperativeMission cooperative = cooperativeMission(21L, location(2L, "협동 장소", 33.52, 126.5));
        givenCandidates(List.of(treasure), List.of(cooperative), List.of(31L));
        givenEstimate(LAT, LNG, treasure.getLocation(), 1000, 13);
        givenEstimate(LAT, LNG, cooperative.getLocation(), 2000, 27);

        List<MissionRecommendInfo> recommends = recommend(Set.of(), Set.of());

        assertThat(recommends).extracting(MissionRecommendInfo::missionType)
                .containsExactlyInAnyOrder("TREASURE", "COOPERATIVE", "CULTURE");
        assertThat(recommends).extracting(MissionRecommendInfo::missionId).containsExactlyInAnyOrder(11L, 21L, 31L);
    }

    @Test
    void 보물찾기와_협동은_가장_가까운_미션을_고른다() {
        TreasureMission far = treasureMission(11L, location(1L, "먼 곳", 33.60, 126.5), 3);
        TreasureMission near = treasureMission(12L, location(2L, "가까운 곳", 33.51, 126.5), 3);
        TreasureMission middle = treasureMission(13L, location(3L, "중간", 33.55, 126.5), 3);
        CooperativeMission cooperativeFar = cooperativeMission(21L, location(4L, "협동 먼 곳", 33.70, 126.5));
        CooperativeMission cooperativeNear = cooperativeMission(22L, location(5L, "협동 가까운 곳", 33.505, 126.5));
        givenCandidates(List.of(far, near, middle), List.of(cooperativeFar, cooperativeNear), List.of());
        givenDistance(LAT, LNG, far.getLocation(), 900);
        givenDistance(LAT, LNG, near.getLocation(), 100);
        givenDistance(LAT, LNG, middle.getLocation(), 500);
        givenDistance(LAT, LNG, cooperativeFar.getLocation(), 800);
        givenDistance(LAT, LNG, cooperativeNear.getLocation(), 50);
        givenEstimate(LAT, LNG, near.getLocation(), 100, 1);
        givenEstimate(LAT, LNG, cooperativeNear.getLocation(), 50, 1);

        assertThat(recommend(Set.of(), Set.of())).extracting(MissionRecommendInfo::missionId)
                .containsExactly(12L, 22L);
    }

    @Test
    void 가장_가까운_미션을_이미_완료했으면_다음_후보를_고른다() {
        TreasureMission far = treasureMission(11L, location(1L, "먼 곳", 33.60, 126.5), 3);
        TreasureMission near = treasureMission(12L, location(2L, "가까운 곳", 33.51, 126.5), 3);
        TreasureMission middle = treasureMission(13L, location(3L, "중간", 33.55, 126.5), 3);
        CooperativeMission cooperativeFar = cooperativeMission(21L, location(4L, "협동 먼 곳", 33.70, 126.5));
        CooperativeMission cooperativeNear = cooperativeMission(22L, location(5L, "협동 가까운 곳", 33.505, 126.5));
        givenCandidates(List.of(far, near, middle), List.of(cooperativeFar, cooperativeNear), List.of());
        givenDistance(LAT, LNG, far.getLocation(), 900);
        givenDistance(LAT, LNG, middle.getLocation(), 500);
        givenEstimate(LAT, LNG, middle.getLocation(), 500, 7);
        givenEstimate(LAT, LNG, cooperativeFar.getLocation(), 800, 11);

        assertThat(recommend(Set.of(12L), Set.of(22L))).extracting(MissionRecommendInfo::missionId)
                .containsExactly(13L, 21L);
    }

    @Test
    void 활성_상태이고_장소가_있는_후보를_요청한다() {
        givenCandidates(List.of(), List.of(), List.of());

        recommend(Set.of(), Set.of());

        verify(treasureMissionRepository).findAllByStatusAndLocationIsNotNull(MissionActivationStatus.ACTIVE);
        verify(cooperativeMissionRepository).findAllByStatusAndLocationIsNotNull(MissionActivationStatus.ACTIVE);
        verify(cultureMissionRepository).findAllByStatus(MissionActivationStatus.ACTIVE);
    }

    @Test
    void 요청_위치가_바뀌면_바뀐_위치에서_가장_가까운_미션을_고른다() {
        TreasureMission northern = treasureMission(11L, location(1L, "북쪽", 33.50, 126.5), 3);
        TreasureMission southern = treasureMission(12L, location(2L, "남쪽", 33.25, 126.5), 3);
        givenCandidates(List.of(northern, southern), List.of(), List.of());
        givenDistance(33.50, 126.5, northern.getLocation(), 10);
        givenDistance(33.50, 126.5, southern.getLocation(), 27_800);
        givenDistance(33.25, 126.5, northern.getLocation(), 27_800);
        givenDistance(33.25, 126.5, southern.getLocation(), 10);
        givenEstimate(33.50, 126.5, northern.getLocation(), 10, 0);
        givenEstimate(33.25, 126.5, southern.getLocation(), 10, 0);

        assertThat(missionRecommender.recommend(33.50, 126.5, Set.of(), Set.of()))
                .extracting(MissionRecommendInfo::missionId).containsExactly(11L);
        assertThat(missionRecommender.recommend(33.25, 126.5, Set.of(), Set.of()))
                .extracting(MissionRecommendInfo::missionId).containsExactly(12L);
    }

    @Test
    void 후보가_없는_유형만_추천에서_뺀다() {
        CooperativeMission cooperative = cooperativeMission(21L, location(1L, "협동 장소", 33.51, 126.5));
        givenCandidates(List.of(), List.of(cooperative), List.of());
        givenEstimate(LAT, LNG, cooperative.getLocation(), 1000, 13);

        assertThat(recommend(Set.of(), Set.of())).extracting(MissionRecommendInfo::missionType)
                .containsExactly("COOPERATIVE");
    }

    @Test
    void 모든_유형에_후보가_없으면_빈_목록을_반환한다() {
        givenCandidates(List.of(), List.of(), List.of());

        assertThat(recommend(Set.of(), Set.of())).isEmpty();
    }

    @Test
    void 문화_미션은_장소와_거리와_시간이_null이다() {
        givenCandidates(List.of(), List.of(), List.of(31L));

        List<MissionRecommendInfo> recommends = recommend(Set.of(), Set.of());

        assertThat(recommends).hasSize(1);
        MissionRecommendInfo culture = recommends.getFirst();
        assertThat(culture.missionId()).isEqualTo(31L);
        assertThat(culture.missionType()).isEqualTo("CULTURE");
        assertThat(culture.locationTitle()).isNull();
        assertThat(culture.location()).isNull();
        assertThat(culture.distanceMeter()).isNull();
        assertThat(culture.durationMinutes()).isNull();
        verifyNoInteractions(travelEstimator);
    }

    @Test
    void 추천_결과에_미션_정보와_장소와_계산된_거리_시간을_담는다() {
        Location location = location(1L, "새별 오름", 33.3663, 126.3577);
        TreasureMission treasure = treasureMission(12L, location, 3);
        givenCandidates(List.of(treasure), List.of(), List.of());
        givenEstimate(LAT, LNG, location, 300, 4);

        MissionRecommendInfo recommend = recommend(Set.of(), Set.of()).getFirst();

        assertThat(recommend.missionId()).isEqualTo(12L);
        assertThat(recommend.missionType()).isEqualTo("TREASURE");
        assertThat(recommend.missionTitle()).isEqualTo("TREASURE 미션");
        assertThat(recommend.locationTitle()).isEqualTo("새별 오름");
        assertThat(recommend.location().lat()).isEqualTo(33.3663);
        assertThat(recommend.location().lng()).isEqualTo(126.3577);
        assertThat(recommend.distanceMeter()).isEqualTo(300);
        assertThat(recommend.durationMinutes()).isEqualTo(4);
    }

    private List<MissionRecommendInfo> recommend(Set<Long> completedTreasureIds, Set<Long> completedCooperativeIds) {
        return missionRecommender.recommend(LAT, LNG, completedTreasureIds, completedCooperativeIds);
    }

    /** 유형별 추천 후보를 준비한다. 문화 후보를 하나만 주면 무작위 선택 결과가 고정된다. */
    private void givenCandidates(List<TreasureMission> treasures, List<CooperativeMission> cooperatives,
                                 List<Long> cultureMissionIds) {
        given(treasureMissionRepository.findAllByStatusAndLocationIsNotNull(MissionActivationStatus.ACTIVE))
                .willReturn(treasures);
        given(cooperativeMissionRepository.findAllByStatusAndLocationIsNotNull(MissionActivationStatus.ACTIVE))
                .willReturn(cooperatives);
        given(cultureMissionRepository.findAllByStatus(MissionActivationStatus.ACTIVE))
                .willReturn(cultureMissionIds.stream().map(id -> cultureMission(id)).toList());
    }

    private void givenDistance(double latitude, double longitude, Location location, double distanceMeter) {
        given(travelEstimator.distanceMeter(latitude, longitude, location.getLatitude(), location.getLongitude()))
                .willReturn(distanceMeter);
    }

    private void givenEstimate(double latitude, double longitude, Location location,
                               int distanceMeter, int durationMinutes) {
        given(travelEstimator.estimate(latitude, longitude, location))
                .willReturn(new TravelEstimate(distanceMeter, durationMinutes));
    }
}
