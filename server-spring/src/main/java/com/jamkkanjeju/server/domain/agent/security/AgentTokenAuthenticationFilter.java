package com.jamkkanjeju.server.domain.agent.security;

import com.jamkkanjeju.server.domain.agent.config.AgentApiProperties;
import com.jamkkanjeju.server.domain.auth.exception.AuthErrorCode;
import com.jamkkanjeju.server.domain.auth.security.JwtAuthenticationFilter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Collections;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

/** 에이전트 경로에서만 고정 토큰을 검증하고 사용자와 분리된 장소 조회·점검 예약·동기화 권한을 부여한다. */
@RequiredArgsConstructor
public class AgentTokenAuthenticationFilter extends OncePerRequestFilter {
    public static final String HEADER = "X-Agent-Token";
    public static final String READ_AUTHORITY = "AGENT_LOCATIONS_READ";
    public static final String MAINTENANCE_WRITE_AUTHORITY = "AGENT_MAINTENANCE_WRITE";
    public static final String SYNC_AUTHORITY = "AGENT_LOCATIONS_SYNC";
    private final AgentApiProperties properties;

    /** 토큰이 없는 요청과 잘못된 요청을 구분하며 원문을 인증 객체에 저장하지 않는다. */
    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        SecurityContextHolder.clearContext();
        List<String> values = Collections.list(request.getHeaders(HEADER));
        if (!values.isEmpty()) {
            String expected = properties.token();
            if (values.size() == 1 && expected != null && !expected.isBlank()
                    && MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8),
                    values.getFirst().getBytes(StandardCharsets.UTF_8))) {
                var context = SecurityContextHolder.createEmptyContext();
                context.setAuthentication(UsernamePasswordAuthenticationToken.authenticated(
                        "agent", null, List.of(new SimpleGrantedAuthority(READ_AUTHORITY),
                                new SimpleGrantedAuthority(MAINTENANCE_WRITE_AUTHORITY),
                                new SimpleGrantedAuthority(SYNC_AUTHORITY))));
                SecurityContextHolder.setContext(context);
            } else {
                request.setAttribute(JwtAuthenticationFilter.AUTH_ERROR_ATTRIBUTE, AuthErrorCode.INVALID_TOKEN);
            }
        }
        chain.doFilter(request, response);
    }
}
