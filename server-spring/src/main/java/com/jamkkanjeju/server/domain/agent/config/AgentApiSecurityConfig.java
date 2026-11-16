package com.jamkkanjeju.server.domain.agent.config;

import com.jamkkanjeju.server.domain.agent.security.AgentTokenAuthenticationFilter;
import com.jamkkanjeju.server.domain.auth.security.JsonAccessDeniedHandler;
import com.jamkkanjeju.server.domain.auth.security.JsonAuthenticationEntryPoint;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

/** 에이전트 요청을 기존 사용자 JWT 인증과 분리하고 명시한 읽기 경로만 허용한다. */
@Configuration
@EnableConfigurationProperties(AgentApiProperties.class)
public class AgentApiSecurityConfig {

    /** 고정 토큰은 에이전트 API 범위에서만 인증 수단으로 사용한다. */
    @Bean
    @Order(1)
    public SecurityFilterChain agentSecurityFilterChain(HttpSecurity http, AgentApiProperties properties,
            JsonAuthenticationEntryPoint entryPoint, JsonAccessDeniedHandler deniedHandler) throws Exception {
        http.securityMatcher("/api/v2/agent/**")
                .csrf(csrf -> csrf.disable())
                .formLogin(login -> login.disable())
                .httpBasic(basic -> basic.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(authorize -> authorize
                        .requestMatchers(HttpMethod.GET, "/api/v2/agent/locations")
                        .hasAuthority(AgentTokenAuthenticationFilter.READ_AUTHORITY)
                        .anyRequest().denyAll())
                .exceptionHandling(errors -> errors.authenticationEntryPoint(entryPoint)
                        .accessDeniedHandler(deniedHandler))
                .addFilterBefore(new AgentTokenAuthenticationFilter(properties), UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }
}
