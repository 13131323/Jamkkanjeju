package com.jamkkanjeju.server.domain.etc.repository;

import com.jamkkanjeju.server.domain.etc.entity.TravelEndingContent;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 결과: saveAndFlush는 엽서 기록을 저장·flush하고 생성된 ID를 포함한 엔티티를 반환한다. 연관 조회는 하지 않는다.
 * 사용: 엽서 저장({@code POST /api/v2/users/me/travel-ending-contents})의 저장 ID·이미지 URL 응답을 구성한다.
 */
public interface TravelEndingContentRepository extends JpaRepository<TravelEndingContent, Long> { }
