package com.jamkkanjeju.server.domain.treasurehunt.repository;

import com.jamkkanjeju.server.domain.treasurehunt.entity.TreasureMissionProgressItem;
import com.jamkkanjeju.server.domain.treasurehunt.entity.TreasureMissionProgressItemId;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** 진행도별 보물 아이템을 조회·저장·삭제하는 레포지토리이다. */
public interface TreasureMissionProgressItemRepository
        extends JpaRepository<TreasureMissionProgressItem, TreasureMissionProgressItemId> {

    /**
     * 결과: 진행도({@code progressId})의 발견·미발견 보물 전체를 아이템 번호 오름차순으로 반환한다.
     * 연관 엔티티는 함께 로딩하지 않으며, 아이템이 없으면 빈 목록이다.
     * 사용: 보물찾기 시작/이어하기({@code POST /api/v2/treasure-missions/{missionId}/progress})에서
     * 저장된 번호·좌표·발견 여부를 응답의 {@code treasureItems}로 변환한다.
     */
    List<TreasureMissionProgressItem> findAllByIdTreasureMissionProgressIdOrderByIdItemIndexAsc(Long progressId);

    /**
     * 결과: 진행도({@code progressId})의 전체 아이템 행 수를 DB COUNT로 반환한다.
     * 발견 여부로 제한하지 않고 연관 엔티티를 로딩하지 않으며, 없으면 0이다.
     * 사용: 보물찾기 시작/이어하기({@code POST /api/v2/treasure-missions/{missionId}/progress}) 응답의
     * {@code treasureCount}를 구성한다. 서비스에서 int로 변환하며 상수나 미션 설정 개수로 대체하지 않는다.
     */
    long countByIdTreasureMissionProgressId(Long progressId);

    /**
     * 결과: 진행도({@code progressId})의 아이템 행 전체를 삭제하고 삭제 행 수를 반환한다. 없으면 0이다.
     * 연관 엔티티는 로딩하지 않으며, 실행 전 미반영 변경을 flush하고 영속성 컨텍스트 전체를 clear하지 않는다.
     * 사용: 보물찾기 시작/이어하기({@code POST /api/v2/treasure-missions/{missionId}/progress})의 재시작에서
     * 기존 아이템 삭제 후 새 좌표의 아이템을 저장해 {@code treasureItems}를 구성한다.
     * 최초 시작·이어하기에는 호출하지 않는다.
     */
    @Modifying(flushAutomatically = true)
    @Query("delete from TreasureMissionProgressItem i where i.id.treasureMissionProgressId = :progressId")
    int deleteAllByProgressId(@Param("progressId") Long progressId);
}
