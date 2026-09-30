package com.jamkkanjeju.server.domain.auth.config;

import com.jamkkanjeju.server.domain.auth.jwt.JwtTokenProvider;
import com.jamkkanjeju.server.domain.auth.security.DevAuthenticationFilter;
import com.jamkkanjeju.server.domain.auth.security.JsonAccessDeniedHandler;
import com.jamkkanjeju.server.domain.auth.security.JsonAuthenticationEntryPoint;
import com.jamkkanjeju.server.domain.auth.security.JwtAuthenticationFilter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Slf4j
@Configuration
@EnableMethodSecurity
@EnableConfigurationProperties(DevAuthProperties.class)
public class SecurityConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http,
                                                   JwtTokenProvider jwtTokenProvider,
                                                   JsonAuthenticationEntryPoint authenticationEntryPoint,
                                                   JsonAccessDeniedHandler accessDeniedHandler,
                                                   DevAuthProperties devAuthProperties) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .formLogin(formLogin -> formLogin.disable())
                .httpBasic(httpBasic -> httpBasic.disable())
                .sessionManagement(session -> session
                        .sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(authorize -> authorize
                        .requestMatchers(
                                "/api/v2/auth/login",
                                "/error",
                                "/actuator/health",
                                "/actuator/info",
                                "/docs",
                                "/docs/**",
                                "/swagger-ui.html",
                                "/swagger-ui/**",
                                "/v3/api-docs/**"
                        ).permitAll()
                        .anyRequest().authenticated())
                .exceptionHandling(exception -> exception
                        .authenticationEntryPoint(authenticationEntryPoint)
                        .accessDeniedHandler(accessDeniedHandler))
                .addFilterBefore(new JwtAuthenticationFilter(jwtTokenProvider),
                        UsernamePasswordAuthenticationFilter.class);

        if (devAuthProperties.enabled()) {
            log.warn("""
                    [개발용 자동 로그인 활성화] 토큰 없이 호출하면 userId={}, role={} 사용자로 인증됩니다. \
                    운영 환경에서는 app.dev-auth.enabled를 반드시 false로 두십시오.""",
                    devAuthProperties.userId(), devAuthProperties.role());
            http.addFilterAfter(new DevAuthenticationFilter(devAuthProperties), JwtAuthenticationFilter.class);
        }

        return http.build();
    }
}
