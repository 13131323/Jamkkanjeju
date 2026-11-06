package com.jamkkanjeju.server.common.client;

import com.jamkkanjeju.server.common.exception.CommonErrorCode;
import com.jamkkanjeju.server.common.image.ImageValidator;
import com.jamkkanjeju.server.common.image.ImageValidator.ValidatedImage;
import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URI;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/** 서버에서 찾은 외부 참조 이미지를 크기·연결/읽기 시간 제한 내에서 검증해 내려받는다. */
@Component
@RequiredArgsConstructor
@Slf4j
public class ReferenceImageClient {
    private final ImageValidator imageValidator;

    /** 참조 이미지를 사용할 수 없으면 이름만 사용하도록 null을 반환한다. */
    public ValidatedImage download(String url) {
        if (url == null || url.isBlank()) return null;
        HttpURLConnection connection = null;
        try {
            URI uri = URI.create(url);
            if (!"https".equalsIgnoreCase(uri.getScheme()) && !"http".equalsIgnoreCase(uri.getScheme())) return null;
            connection = (HttpURLConnection) uri.toURL().openConnection();
            connection.setConnectTimeout(10_000);
            connection.setReadTimeout(10_000);
            connection.setInstanceFollowRedirects(false);
            int status = connection.getResponseCode();
            if (status < 200 || status >= 300 || connection.getContentLengthLong() > ImageValidator.MAX_IMAGE_SIZE_BYTES) return null;
            try (var input = connection.getInputStream()) {
                byte[] bytes = input.readNBytes(ImageValidator.MAX_IMAGE_SIZE_BYTES + 1);
                return imageValidator.validateBytes(bytes, CommonErrorCode.INVALID_REQUEST,
                        CommonErrorCode.INVALID_REQUEST, CommonErrorCode.INVALID_REQUEST);
            }
        } catch (IOException | RuntimeException exception) {
            // URL 자체에는 서명·인증 정보가 있을 수 있어 종류만 기록한다.
            log.info("참조 이미지 생략: errorType={}", exception.getClass().getSimpleName());
            return null;
        } finally {
            if (connection != null) connection.disconnect();
        }
    }
}
