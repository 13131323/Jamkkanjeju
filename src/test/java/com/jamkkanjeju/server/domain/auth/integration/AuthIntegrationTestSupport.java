package com.jamkkanjeju.server.domain.auth.integration;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.auth.entity.UserRole;
import com.jamkkanjeju.server.domain.auth.entity.UserStatus;
import com.jamkkanjeju.server.domain.auth.repository.UserRepository;
import com.jayway.jsonpath.JsonPath;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

/**
 * 실제 MySQL(Flyway 스키마) + 전체 스프링 컨텍스트 + 시큐리티 필터 체인을 띄우는 통합 테스트의 공통 설정.
 * DB 접속 정보는 MYSQL_* 환경변수로, JWT 설정은 여기서 고정값으로 주입한다.
 * 각 테스트는 트랜잭션 안에서 실행되고 끝나면 롤백된다.
 */
@SpringBootTest(properties = {
        "app.jwt.secret-key=dGVzdC1zZWNyZXQta2V5LWZvci1qd3Qtc2lnbmluZy0zMmJ5dGVzIQ==",
        "app.jwt.access-token-expiration=30m",
        "app.jwt.refresh-token-expiration=14d",
        "logging.level.org.hibernate.SQL=warn"
})
@AutoConfigureMockMvc
@Transactional
abstract class AuthIntegrationTestSupport {

    protected static final String LOGIN_URL = "/api/v2/auth/login";
    protected static final String PASSWORD = "password123!";

    @Autowired
    protected MockMvc mockMvc;

    @Autowired
    protected UserRepository userRepository;

    @Autowired
    protected PasswordEncoder passwordEncoder;

    protected User saveUser(String email, UserRole role, UserStatus status) {
        return userRepository.saveAndFlush(User.builder()
                .email(email)
                .passwordHash(passwordEncoder.encode(PASSWORD))
                .nickname("몽글몽글파도")
                .role(role)
                .status(status)
                .build());
    }

    protected static String loginBody(String email, String password, String deviceInfo) {
        String device = deviceInfo == null ? "null" : "\"" + deviceInfo + "\"";
        return """
                {"email": "%s", "password": "%s", "deviceInfo": %s}
                """.formatted(email, password, device);
    }

    /** 로그인해서 응답 JSON 문자열을 돌려준다. */
    protected String login(String email) throws Exception {
        return mockMvc.perform(post(LOGIN_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginBody(email, PASSWORD, null)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
    }

    protected String loginAndGetAccessToken(String email) throws Exception {
        return JsonPath.read(login(email), "$.accessToken");
    }
}
