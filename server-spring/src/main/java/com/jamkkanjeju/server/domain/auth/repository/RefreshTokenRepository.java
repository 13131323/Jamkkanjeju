package com.jamkkanjeju.server.domain.auth.repository;

import com.jamkkanjeju.server.domain.auth.entity.RefreshToken;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

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

    /**
     * 결과: 해시가 일치하는 토큰 기록 한 건을 비관적 쓰기 잠금으로 조회한다. 없으면 빈 Optional이며,
     * 사용자 연관은 함께 로딩하지 않는다. 잠금은 트랜잭션 종료까지 유지된다.
     * 사용: 액세스 토큰 재발급({@code POST /api/v2/auth/refresh})에서 사용자 일치·폐기·만료 여부를 확인하고,
     * 기존 토큰 폐기와 새 토큰 저장을 완료할 때까지 같은 토큰의 동시 재발급을 막는다.
     * 로그아웃({@code POST /api/v2/auth/logout})에서도 같은 잠금으로 해당 기록만 조회한 뒤
     * 상속받은 {@code delete(entity)}로 삭제하여 재발급의 토큰 회전과 충돌하지 않도록 한다.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from RefreshToken r where r.tokenHash = :tokenHash")
    Optional<RefreshToken> findByTokenHashForUpdate(@Param("tokenHash") String tokenHash);
}
