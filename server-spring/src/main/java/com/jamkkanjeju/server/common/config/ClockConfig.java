package com.jamkkanjeju.server.common.config;

import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** 애플리케이션 전역에서 현재 시각 기준으로 쓸 {@link Clock}을 제공하는 설정이다. */
// 현재 시각이 필요한 곳은 Clock을 주입받아 사용한다. (테스트에서 고정 시각으로 교체하기 위함)
@Configuration
public class ClockConfig {

    /** 시스템 기본 시간대의 시계를 빈으로 등록한다. */
    @Bean
    public Clock clock() {
        return Clock.systemDefaultZone();
    }
}
