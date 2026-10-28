package com.jamkkanjeju.server.domain.treasurehunt.repository;

import com.jamkkanjeju.server.domain.treasurehunt.entity.AcquiredArCharacter;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 사용자가 획득한 AR 캐릭터 기록을 저장하는 레포지토리이다.
 * 결과: 상속받은 {@code save(acquiredArCharacter)}는 저장한 획득 기록을 돌려준다. (미션, 사용자)는 UNIQUE이다.
 * 사용: 문화 미션 진행도 저장({@code PATCH /api/v2/culture-missions/{cultureMissionProgressId}/progress})의 완료 보상으로
 * AR 캐릭터를 지급할 때 사용자·캐릭터·공통 미션 ID를 연결한 기록을 저장하고, 응답의 {@code reward.arCharacter}를 구성한다.
 */
public interface AcquiredArCharacterRepository extends JpaRepository<AcquiredArCharacter, Long> {
}
