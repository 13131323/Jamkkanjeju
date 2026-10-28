package com.jamkkanjeju.server.domain.auth.security;

import com.jamkkanjeju.server.domain.auth.exception.AuthErrorCode;
import com.jamkkanjeju.server.domain.auth.jwt.JwtTokenProvider;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
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

/** 요청의 액세스 토큰으로 사용자를 인증하는 필터이다. */
// 토큰이 없거나 잘못돼도 여기서 바로 응답하지 않는다. 인증 없이 호출 가능한 API(permitAll)는 그대로 통과하고,
// 인증이 필요한 API는 JsonAuthenticationEntryPoint가 401로 응답한다. 이때 쓸 오류 코드는 AUTH_ERROR_ATTRIBUTE 요청 속성으로 넘긴다.
// Spring Boot가 서블릿 필터로 자동 등록하지 않도록 빈으로 만들지 않고 SecurityConfig에서 직접 생성한다.
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    public static final String AUTH_ERROR_ATTRIBUTE = JwtAuthenticationFilter.class.getName() + ".AUTH_ERROR";

    private static final String BEARER_PREFIX = "Bearer ";

    private final JwtTokenProvider jwtTokenProvider;

    /** Authorization 헤더가 있으면 인증을 시도한 뒤 다음 필터로 넘긴다. */
    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String header = request.getHeader(HttpHeaders.AUTHORIZATION);

        if (header != null) {
            authenticate(request, header);
        }

        filterChain.doFilter(request, response);
    }

    /** 헤더의 액세스 토큰을 검증해 인증 사용자로 등록하고, 실패하면 오류 코드를 요청에 남긴다. */
    private void authenticate(HttpServletRequest request, String header) {
        if (!header.startsWith(BEARER_PREFIX) || header.length() == BEARER_PREFIX.length()) {
            request.setAttribute(AUTH_ERROR_ATTRIBUTE, AuthErrorCode.INVALID_TOKEN);
            return;
        }

        try {
            AuthUser authUser = jwtTokenProvider.parseAccessToken(header.substring(BEARER_PREFIX.length()).strip());
            UsernamePasswordAuthenticationToken authentication = UsernamePasswordAuthenticationToken.authenticated(
                    authUser, null, List.of(new SimpleGrantedAuthority("ROLE_" + authUser.role().name())));

            SecurityContext context = SecurityContextHolder.createEmptyContext();
            context.setAuthentication(authentication);
            SecurityContextHolder.setContext(context);
        } catch (ExpiredJwtException exception) {
            request.setAttribute(AUTH_ERROR_ATTRIBUTE, AuthErrorCode.EXPIRED_TOKEN);
        } catch (JwtException | IllegalArgumentException exception) {
            request.setAttribute(AUTH_ERROR_ATTRIBUTE, AuthErrorCode.INVALID_TOKEN);
        }
    }
}
