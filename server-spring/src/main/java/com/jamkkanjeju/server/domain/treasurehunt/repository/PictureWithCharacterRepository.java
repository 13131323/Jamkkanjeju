package com.jamkkanjeju.server.domain.treasurehunt.repository;

import com.jamkkanjeju.server.domain.treasurehunt.entity.PictureWithCharacter;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 결과: 기본 저장 메서드는 사용자·사진 URL·저장 시각을 가진 사진 기록을 저장하고 저장된 엔티티를 반환한다.
 * 새 기록의 ID는 DB에서 생성하며, 연관 사용자를 별도로 함께 조회하지 않는다.
 * 사용: AR 캐릭터와 사진 저장({@code POST /api/v2/treasure-missions/pictures-with-character})에서
 * Blob 업로드 후 로그인 사용자·업로드 URL·서버 저장 시각을 기록한다. 정상 응답은 본문 없이 반환한다.
 */
public interface PictureWithCharacterRepository extends JpaRepository<PictureWithCharacter, Long> {
}
