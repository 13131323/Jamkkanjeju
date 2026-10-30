package com.jamkkanjeju.server.domain.treasurehunt.repository;

import com.jamkkanjeju.server.domain.treasurehunt.entity.AcquiredArCharacter;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * 사용자가 획득한 AR 캐릭터 기록을 저장하는 레포지토리이다.
 * 결과: 상속받은 {@code save(acquiredArCharacter)}는 저장한 획득 기록을 돌려준다. (미션, 사용자)는 UNIQUE이다.
 * 사용: 문화 미션 진행도 저장({@code PATCH /api/v2/culture-missions/{cultureMissionProgressId}/progress})의 완료 보상으로
 * AR 캐릭터를 지급할 때 사용자·캐릭터·공통 미션 ID를 연결한 기록을 저장하고, 응답의 {@code reward.arCharacter}를 구성한다.
 */
public interface AcquiredArCharacterRepository extends JpaRepository<AcquiredArCharacter, Long> {

    /**
     * 결과: 사용자·캐릭터 ID 목록에 해당하는 획득 ID·캐릭터 ID·출처 미션 ID·생성 시각이다.
     * 생성 시각·획득 ID 오름차순이며 출처가 없는 기록도 포함한다. 연관 엔티티는 로딩하지 않고 없으면 빈 목록이다.
     * 사용: 마이페이지 조회({@code GET /api/v2/users/me/mypage})에서 조각 수·최초 완성 날짜를 계산하고
     * 이미 해당 캐릭터 조각을 준 미션을 추천에서 제외한다. 빈 캐릭터 ID 목록은 서비스가 조회를 생략한다.
     */
    @Query("""
            select a.id as id, a.arCharacter.id as arCharacterId, m.id as missionId, a.createdAt as createdAt
            from AcquiredArCharacter a left join a.mission m
            where a.user.id = :userId and a.arCharacter.id in :characterIds
            order by a.createdAt asc, a.id asc
            """)
    List<Fragment> findFragmentsByUserIdAndArCharacterIds(@Param("userId") Long userId,
                                                        @Param("characterIds") Collection<Long> characterIds);

    /** 조각 한 개의 소유 캐릭터·출처·생성 시각이다. */
    interface Fragment {
        Long getId();
        Long getArCharacterId();
        Long getMissionId();
        LocalDateTime getCreatedAt();
    }
}
