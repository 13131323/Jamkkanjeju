package com.jamkkanjeju.server.domain.guestbook.repository;

import com.jamkkanjeju.server.domain.guestbook.entity.Guestbook;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * {@code count()}
 * 결과: 서비스 전체의 공통 방명록({@code guestbook}) 행 개수. 일반·길바닥 방명록을 모두 포함하고,
 * 세부 테이블({@code location_guestbook}, {@code road_guestbook})과 중복 집계하지 않는다. 방명록이 없으면 0이다.
 * 사용: 홈 조회({@code GET /api/v2/users/me/home}) 응답의 {@code guestbookCount}.
 */
public interface GuestbookRepository extends JpaRepository<Guestbook, Long> {
}
