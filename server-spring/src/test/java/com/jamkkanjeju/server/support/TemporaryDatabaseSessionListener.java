package com.jamkkanjeju.server.support;

import org.junit.platform.launcher.LauncherSession;
import org.junit.platform.launcher.LauncherSessionListener;

/** JUnit 실행 전체가 끝나면 클래스별로 공유한 임시 DB를 정리한다. */
public class TemporaryDatabaseSessionListener implements LauncherSessionListener {

    @Override
    public void launcherSessionClosed(LauncherSession session) {
        TemporaryMySqlDatabase.cleanup();
    }
}
