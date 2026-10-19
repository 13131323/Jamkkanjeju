package com.jamkkanjeju.server.domain.cooperativemission.repository;

import com.jamkkanjeju.server.domain.cooperativemission.entity.CooperativeMissionProgress;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 협동 미션 팀 진행도를 저장하는 레포지토리이다.
 * 결과: 상속받은 {@code save(progress)}는 저장된 팀 진행도를 반환하며 새 진행도에는 생성된 ID가 부여된다.
 * 연관 엔티티를 함께 조회하지 않으며, 조회 결과가 없는 경우를 다루는 메서드는 아니다.
 * 사용: 협동 미션 시작/이어하기({@code POST /api/v2/cooperative-missions/{missionId}/progress})의
 * 신규 시작에서 팀 진행도를 저장하고 본인 참가자를 연결한다. 저장된 ID와 팀 토큰으로 응답의
 * {@code cooperativeMissionProgressId}, {@code teamToken}을 구성한다.
 */
public interface CooperativeMissionProgressRepository extends JpaRepository<CooperativeMissionProgress, Long> {
}
