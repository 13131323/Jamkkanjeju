package com.jamkkanjeju.server.domain.culturemission.repository;

import com.jamkkanjeju.server.domain.culturemission.entity.CultureMissionProgress;
import com.jamkkanjeju.server.domain.mission.entity.MissionProgressStatus;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 사용자의 문화 미션 진행도를 조회·저장하는 레포지토리이다.
 * 결과: 상속받은 {@code save(progress)}는 저장한 진행도를 돌려주며, 새 진행도는 ID가 채워진다.
 * 사용: {@code save(progress)}는 문화 미션 시작/이어하기({@code POST /api/v2/culture-missions/{missionId}/progress})에서
 * 처음 시작하는 사용자의 진행도를 만드는 데 쓰고, 저장된 ID로 응답의 {@code cultureMissionProgressId}를 구성한다.
 */
public interface CultureMissionProgressRepository extends JpaRepository<CultureMissionProgress, Long> {

    /**
     * 결과: 사용자({@code userId})의 문화 미션 진행도 중 진행 상태가 {@code missionStatus}인 목록.
     * 각 원소는 {@code cultureMission.mission.missionType}(유형·이름)이 함께 로딩되어 있고, 없으면 빈 목록이다.
     * 사용: 홈 조회({@code GET /api/v2/users/me/home}) 응답의 {@code progressMission} 중 CULTURE 항목.
     * IN_PROGRESS로 조회하며, {@code currentStep}은 각 진행도의 {@code currentQuizIndex}를 쓴다.
     */
    @EntityGraph(attributePaths = "cultureMission.mission.missionType")
    List<CultureMissionProgress> findAllByUserIdAndMissionStatus(Long userId, MissionProgressStatus missionStatus);

    /**
     * 결과: 사용자({@code userId})의 문화 미션({@code missionId}) 진행도 한 건(진행 중·완료 무관).
     * (문화 미션, 사용자)가 UNIQUE라 최대 한 건이고, 연관 엔티티는 함께 로딩하지 않으며, 없으면 빈 {@code Optional}이다.
     * 사용: 문화 미션 시작/이어하기({@code POST /api/v2/culture-missions/{missionId}/progress})에서
     * 진행도가 없으면 새로 만들고(201), IN_PROGRESS면 그대로, COMPLETED면 초기화해 재사용한다(200).
     * 응답의 {@code cultureMissionProgressId}와 {@code currentQuizNumber}를 이 진행도로 구성한다.
     */
    Optional<CultureMissionProgress> findByUserIdAndCultureMissionMissionId(Long userId, Long missionId);

    /**
     * 결과: 진행도 ID({@code id})가 사용자({@code userId}) 소유이고 진행 상태가 {@code missionStatus}인 진행도 한 건.
     * 문화 미션과 그 보상 정보({@code cultureMission.arCharacter}, {@code cultureMission.coupon.location})가 함께 로딩되어 있고,
     * 없거나 다른 사용자 것이거나 상태가 다르면 빈 {@code Optional}이다.
     * 사용: 문화 미션 진행도 저장({@code PATCH /api/v2/culture-missions/{cultureMissionProgressId}/progress})에서
     * IN_PROGRESS로 조회해 없으면 {@code CULTURE_MISSION_PROGRESS_NOT_FOUND}로 처리하고, 채점 결과로 퀴즈 번호·정답 수·완료 상태를 갱신한다.
     * 완료 시 미션의 보상 정보로 응답의 {@code reward}를 구성한다.
     */
    @EntityGraph(attributePaths = {"cultureMission.arCharacter", "cultureMission.coupon.location"})
    Optional<CultureMissionProgress> findByIdAndUserIdAndMissionStatus(Long id, Long userId,
                                                                      MissionProgressStatus missionStatus);
}
