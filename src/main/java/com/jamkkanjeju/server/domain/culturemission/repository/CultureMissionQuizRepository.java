package com.jamkkanjeju.server.domain.culturemission.repository;

import com.jamkkanjeju.server.domain.culturemission.entity.CultureMissionQuiz;
import com.jamkkanjeju.server.domain.culturemission.entity.CultureMissionQuizId;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CultureMissionQuizRepository extends JpaRepository<CultureMissionQuiz, CultureMissionQuizId> {

    /**
     * 결과: 전달한 문화 미션 ID별 (미션 ID, 퀴즈 개수) 목록. 예: [(3, 5), (7, 4)].
     * 퀴즈가 하나도 없는 미션은 결과에 포함되지 않는다.
     * 사용: 홈 조회({@code GET /api/v2/users/me/home}) 응답의 {@code progressMission[].totalStep} 중 CULTURE 항목.
     * 진행 중인 문화 미션 ID들을 한 번에 넘겨 미션별 퀴즈 개수를 전체 단계 수로 쓴다.
     */
    @Query("""
            select q.id.cultureMissionId as cultureMissionId, count(q) as quizCount
            from CultureMissionQuiz q
            where q.id.cultureMissionId in :cultureMissionIds
            group by q.id.cultureMissionId
            """)
    List<QuizCount> countByCultureMissionIds(@Param("cultureMissionIds") Collection<Long> cultureMissionIds);

    /**
     * 결과: 문화 미션({@code missionId})의 퀴즈 전체 목록을 퀴즈 번호 오름차순으로 정렬한 것.
     * 연관 엔티티는 함께 로딩하지 않으며, 퀴즈가 없으면 빈 목록이다.
     * 사용: 문화 미션 시작/이어하기({@code POST /api/v2/culture-missions/{missionId}/progress}) 응답의
     * {@code quizDetails}를 이 순서 그대로 구성하고, 목록 크기를 {@code quizCount}로 쓴다.
     */
    List<CultureMissionQuiz> findAllByIdCultureMissionIdOrderByIdQuizIndexAsc(Long missionId);

    interface QuizCount {

        Long getCultureMissionId();

        long getQuizCount();
    }
}
