package com.jamkkanjeju.server.common.config;

import java.net.http.HttpClient;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

/** 연결·응답 제한 시간을 적용한 OpenAI 전용 HTTP 클라이언트를 등록한다. */
@Configuration
@EnableConfigurationProperties(OpenAiProperties.class)
public class OpenAiConfig {
    /** 인증키는 외부 API 호출 시에만 붙이고 빈 등록 과정에서는 외부 통신하지 않는다. */
    @Bean
    public RestClient openAiRestClient(OpenAiProperties properties) {
        HttpClient httpClient = HttpClient.newBuilder().connectTimeout(properties.connectTimeout()).build();
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(httpClient);
        factory.setReadTimeout(properties.readTimeout());
        return RestClient.builder().baseUrl(properties.baseUrl()).requestFactory(factory)
                .defaultHeader(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE).build();
    }
}
