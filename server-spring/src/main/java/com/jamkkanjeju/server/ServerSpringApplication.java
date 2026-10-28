package com.jamkkanjeju.server;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/** 제주 관광 미션/방명록 서비스 백엔드 애플리케이션의 진입점이다. */
@SpringBootApplication
public class ServerSpringApplication {

    /** 스프링 부트 애플리케이션을 실행한다. */
    public static void main(String[] args) {
        SpringApplication.run(ServerSpringApplication.class, args);
    }

}
