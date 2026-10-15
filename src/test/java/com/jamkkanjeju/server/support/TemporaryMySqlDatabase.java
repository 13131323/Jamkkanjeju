package com.jamkkanjeju.server.support;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.test.annotation.DirtiesContext.HierarchyMode;
import org.springframework.test.context.TestContext;

/** 테스트 실행에서 생성한 DB 한 개와 접근 권한만 소유하고 생성·연결·정리를 관리한다. */
final class TemporaryMySqlDatabase {

    private static final String PREFIX = "tour_test_";
    private static final List<TestContext> CONTEXTS = new ArrayList<>();
    private static TemporaryMySqlDatabase current;
    private final String name = PREFIX + UUID.randomUUID().toString().replace("-", "");
    private final String serverUrl;
    private final String adminUsername;
    private final String adminPassword;
    private final String username;
    private final String password;
    private boolean created;
    private boolean granted;

    private TemporaryMySqlDatabase() {
        String host = environment("TEST_MYSQL_HOST", "localhost");
        String port = environment("TEST_MYSQL_PORT", environment("MYSQL_HOST_PORT", "3306"));
        serverUrl = "jdbc:mysql://" + host + ":" + port
                + "/?useUnicode=true&characterEncoding=utf8&serverTimezone=Asia/Seoul&allowPublicKeyRetrieval=true";
        adminUsername = environment("TEST_MYSQL_ADMIN_USER", "root");
        adminPassword = requiredEnvironment("MYSQL_ROOT_PASSWORD");
        username = environment("MYSQL_USER", "tour");
        password = requiredEnvironment("MYSQL_PASSWORD");
    }

    /** DB가 필요한 첫 테스트에서만 생성하고 같은 실행의 다른 클래스는 이를 재사용한다. */
    static synchronized TemporaryMySqlDatabase getOrCreate() {
        if (current == null) {
            TemporaryMySqlDatabase database = new TemporaryMySqlDatabase();
            current = database;
            Runtime.getRuntime().addShutdownHook(new Thread(TemporaryMySqlDatabase::cleanup, "temporary-mysql-cleanup"));
            try (Connection connection = database.adminConnection(); Statement statement = connection.createStatement()) {
                statement.executeUpdate("CREATE DATABASE `" + database.safeName() + "` CHARACTER SET utf8mb4");
                database.created = true;
                statement.executeUpdate("GRANT ALL PRIVILEGES ON `" + database.safeName() + "`.* TO " + database.account());
                database.granted = true;
                System.out.println("[임시 테스트 DB 생성] " + database.name);
            } catch (SQLException exception) {
                cleanup();
                throw new IllegalStateException("임시 MySQL DB 생성 실패. MySQL 실행 및 관리자 접속·권한을 확인하십시오. 개발 DB로 연결하지 않습니다.", exception);
            }
        }
        return current;
    }

    static synchronized void registerContext(TestContext context) {
        CONTEXTS.add(context);
    }

    /** 캐시된 연결을 먼저 닫고 이 실행에서 생성한 DB·권한만 제거한다. */
    static synchronized void cleanup() {
        RuntimeException contextFailure = null;
        for (TestContext context : CONTEXTS) {
            try {
                context.markApplicationContextDirty(HierarchyMode.EXHAUSTIVE);
            } catch (RuntimeException exception) {
                contextFailure = exception;
            }
        }
        CONTEXTS.clear();
        if (current != null) {
            TemporaryMySqlDatabase database = current;
            try (Connection connection = database.adminConnection(); Statement statement = connection.createStatement()) {
                if (database.created) {
                    statement.executeUpdate("DROP DATABASE `" + database.safeName() + "`");
                    database.created = false;
                }
                if (database.granted) {
                    statement.executeUpdate("REVOKE ALL PRIVILEGES ON `" + database.safeName() + "`.* FROM " + database.account());
                    database.granted = false;
                }
                current = null;
                System.out.println("[임시 테스트 DB 삭제] " + database.name);
            } catch (SQLException exception) {
                throw new IllegalStateException("임시 테스트 DB 정리 실패: " + database.safeName(), exception);
            }
        }
        if (contextFailure != null) {
            throw new IllegalStateException("테스트 컨텍스트 종료 실패", contextFailure);
        }
    }

    String jdbcUrl() {
        return serverUrl.replace("/?", "/" + safeName() + "?");
    }

    String name() {
        return name;
    }

    String username() {
        return username;
    }

    String password() {
        return password;
    }

    private Connection adminConnection() throws SQLException {
        return DriverManager.getConnection(serverUrl, adminUsername, adminPassword);
    }

    /** 생성·삭제 대상은 코드가 생성한 접두사와 UUID 형식의 이름으로만 제한한다. */
    private String safeName() {
        if (!name.matches("tour_test_[0-9a-f]{32}")) {
            throw new IllegalStateException("임시 DB 이름이 안전한 형식이 아닙니다.");
        }
        return name;
    }

    private String account() {
        return "'" + username.replace("\\", "\\\\").replace("'", "''") + "'@'%'";
    }

    private static String environment(String key, String fallback) {
        String value = System.getenv(key);
        return value == null || value.isBlank() ? fallback : value;
    }

    private static String requiredEnvironment(String key) {
        String value = environment(key, null);
        if (value == null) {
            throw new IllegalStateException("통합 테스트에 필요한 환경변수가 없습니다: " + key);
        }
        return value;
    }
}
