package com.jamkkanjeju.server.common.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Swagger UI(/docs)와 OpenAPI 문서(/v3/api-docs)의 API 정보와 JWT 인증 방식을 정의하는 설정이다. */
// 우측 상단 Authorize 버튼에 로그인 응답의 accessToken을 넣으면 Authorization: Bearer 헤더가 붙는다.
@Configuration
public class OpenApiConfig {

    private static final String BEARER_AUTH = "bearerAuth";

    /** API 문서 정보와 Bearer JWT 보안 스키마를 담은 OpenAPI 정의를 등록한다. */
    @Bean
    public OpenAPI openAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("Jamkkanjeju API")
                        .version("v2"))
                .components(new Components()
                        .addSecuritySchemes(BEARER_AUTH, new SecurityScheme()
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT")))
                .addSecurityItem(new SecurityRequirement().addList(BEARER_AUTH));
    }
}
