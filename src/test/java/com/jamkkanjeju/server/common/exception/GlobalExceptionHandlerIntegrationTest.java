package com.jamkkanjeju.server.common.exception;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jamkkanjeju.server.domain.auth.exception.AuthErrorCode;
import com.jamkkanjeju.server.domain.auth.jwt.JwtTokenProvider;
import com.jamkkanjeju.server.domain.auth.support.AuthFixtures;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * {@link GlobalExceptionHandler}의 분기마다 예외를 하나씩 발생시켜
 * 응답의 HTTP 상태 + code + message가 기대대로인지 검증한다.
 * 테스트 URL은 인증이 필요하므로 실제 액세스 토큰을 발급해 Authorization 헤더로 보낸다.
 */
@SpringBootTest(properties = {
        "app.jwt.secret-key=dGVzdC1zZWNyZXQta2V5LWZvci1qd3Qtc2lnbmluZy0zMmJ5dGVzIQ==",
        "app.jwt.access-token-expiration=30m",
        "app.jwt.refresh-token-expiration=14d",
        "app.dev-auth.enabled=false",
        "logging.level.org.hibernate.SQL=warn"
})
@AutoConfigureMockMvc
@Import(GlobalExceptionHandlerIntegrationTest.ExceptionTestController.class)
class GlobalExceptionHandlerIntegrationTest {

    private static final String BASE_URL = "/test/exceptions";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    private String accessToken;

    @BeforeEach
    void setUp() {
        accessToken = jwtTokenProvider.createAccessToken(AuthFixtures.activeUser(1L)).value();
    }

    /** 분기 1. BusinessException -> ErrorCode에 정의된 상태, code, message */
    @Test
    void BusinessException은_ErrorCode대로_응답한다() throws Exception {
        expectError(perform(get(BASE_URL + "/business")),
                401, "INVALID_CREDENTIALS", "이메일 또는 비밀번호가 올바르지 않습니다.");
    }

    /** 분기 2. 요청값 오류 -> 400 INVALID_REQUEST */
    @Test
    void 요청값_검증_실패는_400_INVALID_REQUEST() throws Exception {
        expectError(perform(post(BASE_URL + "/body")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"\"}")),
                400, "INVALID_REQUEST", "요청값이 올바르지 않습니다.");
    }

    /** 분기 3-1. AccessDeniedException -> 다시 던져서 시큐리티가 403 */
    @Test
    void AccessDeniedException은_403_FORBIDDEN() throws Exception {
        expectError(perform(get(BASE_URL + "/access-denied")),
                403, "FORBIDDEN", "접근 권한이 없습니다.");
    }

    /** 분기 3-2. AuthenticationException -> 다시 던져서 시큐리티가 401 */
    @Test
    void AuthenticationException은_401_UNAUTHORIZED() throws Exception {
        expectError(perform(get(BASE_URL + "/authentication")),
                401, "UNAUTHORIZED", "인증이 필요합니다.");
    }

    /** 분기 4. Spring MVC 4xx 예외 -> 상태 유지, code는 HttpStatus 이름 */
    @Test
    void 지원하지_않는_HTTP_메서드는_405_METHOD_NOT_ALLOWED() throws Exception {
        expectError(perform(get(BASE_URL + "/body")),
                405, "METHOD_NOT_ALLOWED", "요청을 처리할 수 없습니다.");
    }

    /** 분기 5. 그 밖의 예외 -> 500 INTERNAL_SERVER_ERROR (내부 메시지 노출 안 함) */
    @Test
    void 처리되지_않은_예외는_500_INTERNAL_SERVER_ERROR() throws Exception {
        expectError(perform(get(BASE_URL + "/unexpected")),
                500, "INTERNAL_SERVER_ERROR", "서버 내부 오류가 발생했습니다.");
    }

    private ResultActions perform(MockHttpServletRequestBuilder request) throws Exception {
        return mockMvc.perform(request.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken));
    }

    private static void expectError(ResultActions result, int status, String code, String message) throws Exception {
        result.andExpect(status().is(status))
                .andExpect(jsonPath("$.code").value(code))
                .andExpect(jsonPath("$.message").value(message));
    }

    /** 분기마다 예외를 일부러 발생시키는 테스트 전용 컨트롤러. */
    @TestConfiguration
    @RestController
    @RequestMapping(BASE_URL)
    static class ExceptionTestController {

        record SampleRequest(@NotBlank String name) {
        }

        @GetMapping("/business")
        void business() {
            throw new BusinessException(AuthErrorCode.INVALID_CREDENTIALS);
        }

        @PostMapping("/body")
        String body(@Valid @RequestBody SampleRequest request) {
            return request.name();
        }

        @GetMapping("/access-denied")
        void accessDenied() {
            throw new AccessDeniedException("denied");
        }

        @GetMapping("/authentication")
        void authentication() {
            throw new BadCredentialsException("bad credentials");
        }

        @GetMapping("/unexpected")
        void unexpected() {
            throw new IllegalStateException("내부 구현 상세가 담긴 메시지");
        }
    }
}
