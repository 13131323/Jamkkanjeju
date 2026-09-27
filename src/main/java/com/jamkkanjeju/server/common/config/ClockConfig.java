package com.jamkkanjeju.server.common.config;

import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** 현재 시각이 필요한 곳은 {@link Clock}을 주입받아 사용한다. (테스트에서 고정 시각으로 교체하기 위함) */
@Configuration
public class ClockConfig {

    @Bean
    public Clock clock() {
        return Clock.systemDefaultZone();
    }
}
