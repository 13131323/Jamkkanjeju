package com.jamkkanjeju.server.support;

import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.TestContext;
import org.springframework.test.context.TestExecutionListeners;
import org.springframework.test.context.support.AbstractTestExecutionListener;

/** 모든 DB 통합 테스트가 실행별 임시 MySQL DB를 공유하도록 연결하는 공통 기반 클래스이다. */
@TestExecutionListeners(listeners = MySqlIntegrationTestSupport.ContextCleanupListener.class,
        mergeMode = TestExecutionListeners.MergeMode.MERGE_WITH_DEFAULTS)
public abstract class MySqlIntegrationTestSupport {

    /** 앱 환경변수 대신 이번 실행에서 생성한 DB를 데이터소스와 Flyway에 지정한다. */
    @DynamicPropertySource
    static void temporaryDatabaseProperties(DynamicPropertyRegistry registry) {
        TemporaryMySqlDatabase database = TemporaryMySqlDatabase.getOrCreate();
        registry.add("spring.datasource.url", database::jdbcUrl);
        registry.add("spring.datasource.username", database::username);
        registry.add("spring.datasource.password", database::password);
        registry.add("spring.flyway.url", database::jdbcUrl);
        registry.add("spring.flyway.user", database::username);
        registry.add("spring.flyway.password", database::password);
        registry.add("spring.flyway.schemas", database::name);
        registry.add("spring.flyway.default-schema", database::name);
        registry.add("app.dev-auth.enabled", () -> false);
        registry.add("app.jwt.secret-key", () -> "dGVzdC1zZWNyZXQta2V5LWZvci1qd3Qtc2lnbmluZy0zMmJ5dGVzIQ==");
        registry.add("app.jwt.access-token-expiration", () -> "30m");
        registry.add("app.jwt.refresh-token-expiration", () -> "14d");
    }

    /** 실행 종료 시 캐시된 스프링 컨텍스트도 닫을 수 있도록 테스트 컨텍스트를 기록한다. */
    public static class ContextCleanupListener extends AbstractTestExecutionListener {

        @Override
        public void beforeTestClass(TestContext testContext) {
            TemporaryMySqlDatabase.registerContext(testContext);
        }
    }
}
