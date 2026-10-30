package com.jamkkanjeju.server.domain.treasurehunt.repository;

import com.jamkkanjeju.server.domain.treasurehunt.entity.ArCharacter;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

/** AR 캐릭터의 기준 정보를 조회한다. */
public interface ArCharacterRepository extends JpaRepository<ArCharacter, Long> {

    /**
     * 결과: ID 범위 내부와 경계의 캐릭터를 ID 오름차순으로 반환하며 없으면 빈 목록이다.
     * 연관 엔티티는 로딩하지 않는다.
     * 사용: 마이페이지 조회({@code GET /api/v2/users/me/mypage})에서 도감 범위를 전달하여
     * 캐릭터 상세와 필요 조각 수를 구성하고 사용자 획득 집계의 대상 ID로 사용한다.
     */
    List<ArCharacter> findAllByIdBetweenOrderByIdAsc(Long minId, Long maxId);
}
