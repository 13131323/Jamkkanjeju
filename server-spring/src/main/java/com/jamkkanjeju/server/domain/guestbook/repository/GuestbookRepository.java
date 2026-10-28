package com.jamkkanjeju.server.domain.guestbook.repository;

import com.jamkkanjeju.server.domain.guestbook.entity.Guestbook;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * {@code count()}
 * 결과: 서비스 전체의 공통 방명록({@code guestbook}) 행 개수. 일반·길바닥 방명록을 모두 포함하고,
 * 세부 테이블({@code location_guestbook}, {@code road_guestbook})과 중복 집계하지 않는다. 방명록이 없으면 0이다.
 * 사용: 홈 조회({@code GET /api/v2/users/me/home}) 응답의 {@code guestbookCount}.
 *
 * {@code save()}, {@code flush()}
 * 결과: 작성자·방문 날짜·콘텐츠·저장 시각·상태를 가진 공통 방명록을 저장하고,
 * flush 시 DB에 반영한다. 새 기록의 ID는 자동 생성되며 연관 엔티티를 함께 조회하지 않는다.
 * 사용: 방명록 작성({@code POST /api/v2/guestbooks})에서 공통 기록의 ID를 유형별 기록과 Blob 경로에 쓰고,
 * 업로드 URL·제목을 반영한 실제 저장값으로 작성 응답을 구성한다. 커밋과 실패 처리는 서비스가 관리한다.
 */
public interface GuestbookRepository extends JpaRepository<Guestbook, Long> {

    /**
     * 결과: ID가 일치하는 공통 방명록 한 건을 비관적 쓰기 잠금으로 조회한다.
     * 상태·작성자와 무관하며 연관 엔티티는 함께 로딩하지 않고, 없으면 빈 {@code Optional}이다.
     * 잠금은 트랜잭션 종료까지 유지된다.
     * 사용: 방명록 좋아요 토글({@code POST /api/v2/guestbooks/{guestbookId}/like})에서 서비스가
     * 존재·활성 여부를 확인한 뒤 좋아요 등록·삭제와 전체 개수 집계를 같은 잠금 범위에서 처리한다.
     * 응답의 {@code guestbookId}를 구성하며 작성자·장소·미션 조건은 조회에 추가하지 않는다.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select g from Guestbook g where g.id = :id")
    Optional<Guestbook> findByIdForUpdate(@Param("id") Long id);
}
