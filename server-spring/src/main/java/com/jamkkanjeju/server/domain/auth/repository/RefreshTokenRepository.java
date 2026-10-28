package com.jamkkanjeju.server.domain.auth.repository;

import com.jamkkanjeju.server.domain.auth.entity.RefreshToken;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/** 리프레시 토큰 기록을 저장·조회하는 레포지토리이다. */
public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {

    /**
     * 결과: 토큰 해시({@code tokenHash})가 일치하는 리프레시 토큰 기록 한 건이다. 해시는 유일하므로 최대 한 건이고,
     * 연관 엔티티({@code user})는 함께 로딩하지 않으며, 없으면 빈 {@code Optional}이다.
     * 사용: 현재 운영 코드에서는 쓰지 않고, 로그인({@code POST /api/v2/auth/login}) 통합 테스트에서
     * 발급한 리프레시 토큰이 해시로 저장됐는지 확인하는 데 쓴다.
     * 로그인 처리에서는 상속받은 {@code save(entity)}로 발급한 리프레시 토큰의 해시를 저장한다.
     */
    Optional<RefreshToken> findByTokenHash(String tokenHash);
}
