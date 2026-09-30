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

/**
 * 개발 편의용 자동 로그인 필터. {@code app.dev-auth.enabled=true}일 때만 등록된다.
 *
 * <p>{@link JwtAuthenticationFilter} 다음에 동작하며, {@code Authorization} 헤더가 아예 없을 때만
 * 설정된 사용자를 SecurityContext에 넣는다. 따라서
 * <ul>
 *   <li>토큰을 보내면 그 토큰이 그대로 쓰인다 (실제 로그인 흐름 확인 가능)</li>
 *   <li>잘못된 토큰을 보내면 원래대로 401이 난다 (오류 응답 확인 가능)</li>
 *   <li>헤더를 안 보내면 지정한 사용자로 통과한다 (Swagger에서 바로 호출)</li>
 * </ul>
 *
 * <p>"토큰 없음 → 401"만은 이 필터가 켜져 있는 동안 확인할 수 없으므로, 그때는 설정을 끄고 확인한다.
 *
 * <p>Spring Boot가 서블릿 필터로 자동 등록하지 않도록 빈으로 만들지 않고 SecurityConfig에서 직접 생성한다.
 */
@RequiredArgsConstructor
public class DevAuthenticationFilter extends OncePerRequestFilter {

    private final DevAuthProperties properties;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        if (shouldAuthenticate(request)) {
            authenticate();
        }

        filterChain.doFilter(request, response);
    }

    private boolean shouldAuthenticate(HttpServletRequest request) {
        return request.getHeader(HttpHeaders.AUTHORIZATION) == null
                && SecurityContextHolder.getContext().getAuthentication() == null;
    }

    private void authenticate() {
        AuthUser authUser = new AuthUser(properties.userId(), properties.role());
        UsernamePasswordAuthenticationToken authentication = UsernamePasswordAuthenticationToken.authenticated(
                authUser, null, List.of(new SimpleGrantedAuthority("ROLE_" + authUser.role().name())));

        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context);
    }
}
