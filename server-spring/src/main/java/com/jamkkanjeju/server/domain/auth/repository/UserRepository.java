package com.jamkkanjeju.server.domain.auth.repository;

import com.jamkkanjeju.server.domain.auth.entity.User;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * 사용자 계정을 조회하는 레포지토리이다.
 * 결과: 상속받은 {@code findById(id)}는 해당 ID의 사용자 한 건이며 연관 엔티티({@code onboardingResult})는 함께 로딩하지 않고,
 * 없으면 빈 {@code Optional}이다.
 * 사용: {@code findById(id)}는 온보딩 완료({@code PATCH /api/v2/users/me}), 홈 조회({@code GET /api/v2/users/me/home}),
 * 문화 미션 시작/이어하기({@code POST /api/v2/culture-missions/{cultureMissionId}/progress})에서 로그인 사용자를 확인하는 데 쓰고,
 * 없으면 서비스가 {@code UNAUTHORIZED}로 처리한다. 온보딩 완료는 조회한 사용자에게 온보딩 결과를 배정해 응답을 만들고,
 * 홈 조회는 사용자의 온보딩 결과로 캐릭터 이미지를 구성하며, 문화 미션 시작은 새 진행도의 사용자로 연결한다.
 * 문화 미션 진행도 저장({@code PATCH /api/v2/culture-missions/{cultureMissionProgressId}/progress})도 같은 방식으로 사용자를 확인하고,
 * 완료 보상으로 포인트를 지급하면 조회한 사용자의 포인트에 누적한다.
 * 보물찾기 시작/이어하기({@code POST /api/v2/treasure-missions/{missionId}/progress})도 같은 방식으로
 * 사용자를 확인하고, 최초 진행도의 사용자로 연결한다.
 */
public interface UserRepository extends JpaRepository<User, Long> {

    /**
     * 결과: ID({@code id})의 사용자 한 건을 비관적 쓰기 잠금으로 조회한다. 연관 엔티티는 함께 로딩하지 않으며,
     * 없으면 빈 {@code Optional}이다. 잠금은 트랜잭션 종료까지 유지된다.
     * 사용: 협동 미션 시작/이어하기({@code POST /api/v2/cooperative-missions/{missionId}/progress})와
     * URL로 참여 요청({@code POST /api/v2/cooperative-missions/join-requests})에서 참가 기록 조회와 생성 전에
     * 사용자를 잠가 같은 사용자·같은 미션의 진행 중인 팀에 중복 참가하는 것을 막는다.
     * 신규 팀의 방장 또는 URL로 참여 요청하는 팀원으로 연결하고 각 응답의 진행도·참가자 정보를 구성한다.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from User u where u.id = :id")
    Optional<User> findByIdForUpdate(@Param("id") Long id);

    /**
     * 결과: 이메일({@code email})이 일치하는 사용자 한 건이다. 이메일은 유일하므로 최대 한 건이고,
     * 연관 엔티티는 함께 로딩하지 않으며, 없으면 빈 {@code Optional}이다.
     * 사용: 로그인({@code POST /api/v2/auth/login})에서 정규화된 이메일로 사용자를 찾는다. 서비스가 비밀번호 일치 여부로 걸러
     * 없거나 불일치하면 {@code INVALID_CREDENTIALS}로 처리하고, 찾은 사용자로 토큰을 발급해 응답의 {@code user}를 구성한다.
     */
    Optional<User> findByEmail(String email);
}
