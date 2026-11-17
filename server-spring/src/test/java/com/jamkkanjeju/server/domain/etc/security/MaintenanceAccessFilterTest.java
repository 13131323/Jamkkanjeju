package com.jamkkanjeju.server.domain.etc.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verifyNoInteractions;

import com.jamkkanjeju.server.domain.auth.security.SecurityErrorResponseWriter;
import com.jamkkanjeju.server.domain.etc.service.MaintenanceStateService;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import tools.jackson.databind.json.JsonMapper;

/** 점검 상태와 요청 경로·메서드에 따른 필터의 응답을 검증한다. */
@ExtendWith(MockitoExtension.class)
class MaintenanceAccessFilterTest {
    @Mock MaintenanceStateService stateService;
    MaintenanceAccessFilter filter;

    @BeforeEach
    void setUp() {
        filter = new MaintenanceAccessFilter(stateService,
                new SecurityErrorResponseWriter(JsonMapper.builder().build()));
    }

    @ParameterizedTest
    @CsvSource({"GET,/api/v2/map", "POST,/api/v2/guestbooks", "PATCH,/api/v2/coupons/1/use",
            "DELETE,/api/v2/users/me", "POST,/api/v2/auth/logout", "POST,/api/v2/users/me/home"})
    void 점검_중_일반_API는_503으로_차단한다(String method, String path) throws Exception {
        given(stateService.isInProgress()).willReturn(true);
        var called = new AtomicBoolean();
        var response = run(method, path, called);
        assertThat(response.getStatus()).isEqualTo(503);
        assertThat(response.getContentAsString()).contains("SERVICE_UNDER_MAINTENANCE");
        assertThat(called).isFalse();
    }

    @ParameterizedTest
    @CsvSource({"GET,/api/v2/users/me/home", "POST,/api/v2/auth/login", "POST,/api/v2/auth/refresh"})
    void 허용_API는_다음_인증_체인으로_진행한다(String method, String path) throws Exception {
        given(stateService.isInProgress()).willReturn(true);
        var called = new AtomicBoolean();
        assertThat(run(method, path, called).getStatus()).isEqualTo(200);
        assertThat(called).isTrue();
    }

    @ParameterizedTest
    @CsvSource({"OPTIONS,/api/v2/map", "GET,/actuator/health", "GET,/docs"})
    void 비대상_요청은_DB를_조회하지_않는다(String method, String path) throws Exception {
        var called = new AtomicBoolean();
        run(method, path, called);
        assertThat(called).isTrue();
        verifyNoInteractions(stateService);
    }

    @Test
    void 점검_중이_아니면_일반_API를_허용한다() throws Exception {
        given(stateService.isInProgress()).willReturn(false);
        var called = new AtomicBoolean();
        run("POST", "/api/v2/guestbooks", called);
        assertThat(called).isTrue();
    }

    @Test
    void 상태_조회_실패는_공통_500이며_우회하지_않는다() throws Exception {
        given(stateService.isInProgress()).willThrow(new IllegalStateException("test failure"));
        var called = new AtomicBoolean();
        var response = run("GET", "/api/v2/map", called);
        assertThat(response.getStatus()).isEqualTo(500);
        assertThat(response.getContentAsString()).contains("INTERNAL_SERVER_ERROR");
        assertThat(called).isFalse();
    }

    private MockHttpServletResponse run(String method, String path, AtomicBoolean called) throws Exception {
        var response = new MockHttpServletResponse();
        filter.doFilter(new MockHttpServletRequest(method, path), response, (request, result) -> called.set(true));
        return response;
    }
}
