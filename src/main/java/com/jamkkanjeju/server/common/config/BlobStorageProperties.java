package com.jamkkanjeju.server.common.config;

import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** 여러 도메인에서 공유하는 Azure Blob 연결 정보와 대상 컨테이너 설정이다. */
@Validated
@ConfigurationProperties(prefix = "app.blob-storage")
public record BlobStorageProperties(
        // 키가 없더라도 앱은 기동하고, 파일 업로드 요청 시 설정 누락을 처리한다.
        String connectionString,
        @NotBlank String container
) {
    /** 연결 문자열이 객체 출력이나 로그에 노출되지 않도록 숨긴다. */
    @Override
    public String toString() {
        return "BlobStorageProperties[connectionString=***, container=" + container + "]";
    }
}
