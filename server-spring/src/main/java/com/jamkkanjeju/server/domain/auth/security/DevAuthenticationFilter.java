package com.jamkkanjeju.server.domain.auth.security;

import com.jamkkanjeju.server.domain.auth.config.DevAuthProperties;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

/** 개발 환경에서 토큰 없이 호출한 요청을 설정된 사용자로 인증해 주는 필터이다. */
// app.dev-auth.enabled=true일 때만 JwtAuthenticationFilter 다음에 등록된다.
// 토큰을 보내면 그 토큰이 그대로 쓰이고, 잘못된 토큰은 원래대로 401이 나며, 헤더를 안 보낼 때만 지정한 사용자로 통과한다.
// "토큰 없음 → 401"만은 이 필터가 켜져 있는 동안 확인할 수 없으므로, 그때는 설정을 끄고 확인한다.
// Spring Boot가 서블릿 필터로 자동 등록하지 않도록 빈으로 만들지 않고 SecurityConfig에서 직접 생성한다.
@RequiredArgsConstructor
public class DevAuthenticationFilter extends OncePerRequestFilter {

    private final DevAuthProperties properties;

    /** 자동 로그인 대상 요청이면 설정된 사용자로 인증한 뒤 다음 필터로 넘긴다. */
    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        if (shouldAuthenticate(request)) {
            authenticate();
        }

        filterChain.doFilter(request, response);
    }

    /** 요청이 자동 로그인 대상인지 판단한다. */
    private boolean shouldAuthenticate(HttpServletRequest request) {
        // Authorization 헤더가 아예 없고 아직 인증되지 않은 요청만 대상이다.
        return request.getHeader(HttpHeaders.AUTHORIZATION) == null
                && SecurityContextHolder.getContext().getAuthentication() == null;
    }

    /** 설정된 사용자를 현재 요청의 인증 사용자로 등록한다. */
    private void authenticate() {
        AuthUser authUser = new AuthUser(properties.userId(), properties.role());
        UsernamePasswordAuthenticationToken authentication = UsernamePasswordAuthenticationToken.authenticated(
                authUser, null, List.of(new SimpleGrantedAuthority("ROLE_" + authUser.role().name())));

        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context);
    }
}
