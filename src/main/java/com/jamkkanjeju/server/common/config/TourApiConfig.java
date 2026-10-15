package com.jamkkanjeju.server.common.config;

import java.net.http.HttpClient;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

/** TourAPI 설정값과 외부 요청용 HTTP 클라이언트를 Spring 빈으로 등록한다. */
@Configuration
@EnableConfigurationProperties(TourApiProperties.class)
public class TourApiConfig {

    /** TourAPI 기본 URL과 연결·응답 대기 시간을 적용한 전용 클라이언트이다. */
    @Bean
    public RestClient tourApiRestClient(TourApiProperties properties) {
        HttpClient httpClient = HttpClient.newBuilder()
                .connectTimeout(properties.connectTimeout())
                .build();
        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
        requestFactory.setReadTimeout(properties.readTimeout());

        return RestClient.builder()
                .baseUrl(properties.baseUrl())
                .requestFactory(requestFactory)
                .defaultHeader(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
                .build();
    }
}
