package com.jamkkanjeju.server.common.client;

import com.jamkkanjeju.server.common.config.OpenAiProperties;
import com.jamkkanjeju.server.common.image.ImageValidator;
import com.jamkkanjeju.server.common.image.ImageValidator.ValidatedImage;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.Arrays;
import java.util.Base64;
import java.util.List;
import javax.imageio.ImageIO;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.MediaType;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** 검증된 참조 이미지와 프롬프트를 보내 세로형 PNG 한 장을 받는 OpenAI 클라이언트이다. */
@Slf4j
@Component
public class OpenAiClient {
    private static final byte[] PNG_SIGNATURE = {(byte) 0x89, 'P', 'N', 'G', 13, 10, 26, 10};
    private final RestClient restClient;
    private final OpenAiProperties properties;
    private final JsonMapper jsonMapper;

    public OpenAiClient(@Qualifier("openAiRestClient") RestClient restClient,
                        OpenAiProperties properties, JsonMapper jsonMapper) {
        this.restClient = restClient;
        this.properties = properties;
        this.jsonMapper = jsonMapper;
    }

    /** 호출 서비스가 AI 처리와 추후 대체 동작을 선택할 수 있도록 활성화 설정을 제공한다. */
    public boolean isEnabled() {
        return properties.enabled();
    }

    /** FastAPI와 동일하게 참조 이미지들을 편집 API로 보내고 실제 PNG 한 장만 반환한다. */
    public byte[] editImage(String prompt, List<ValidatedImage> images) {
        // 비활성화는 키 유무와 관계없이 외부 호출을 차단한다. 호출 서비스는 isEnabled()로 미리 분기한다.
        if (!isEnabled()) throw new IllegalStateException("OpenAI 기능이 비활성화되어 있습니다.");
        if (!StringUtils.hasText(properties.apiKey())) throw new IllegalStateException("OpenAI 인증키가 설정되지 않았습니다.");
        if (!StringUtils.hasText(prompt) || images == null || images.isEmpty()) {
            throw new IllegalArgumentException("프롬프트와 참조 이미지가 필요합니다.");
        }
        MultipartBodyBuilder body = new MultipartBodyBuilder();
        body.part("model", properties.imageModel());
        body.part("prompt", prompt);
        body.part("n", "1");
        body.part("size", "1024x1536");
        body.part("output_format", "png");
        for (int index = 0; index < images.size(); index++) {
            ValidatedImage image = images.get(index);
            body.part("image[]", new ByteArrayResource(image.data()))
                    .filename("input-" + (index + 1) + image.format().extension())
                    .contentType(MediaType.parseMediaType(image.format().contentType()));
        }
        try {
            String response = restClient.post().uri("/images/edits")
                    .headers(headers -> headers.setBearerAuth(properties.apiKey()))
                    .contentType(MediaType.MULTIPART_FORM_DATA).body(body.build()).retrieve().body(String.class);
            return decodePng(response);
        } catch (RestClientResponseException exception) {
            // 응답 본문·예외 메시지·요청 프롬프트·이미지·인증키는 로그나 예외 원인에 남기지 않는다.
            log.warn("OpenAI 이미지 생성 실패: HTTP status={}", exception.getStatusCode().value());
            throw new IllegalStateException("OpenAI 이미지 생성에 실패했습니다.");
        } catch (RuntimeException exception) {
            log.warn("OpenAI 이미지 생성 실패: errorType={}", exception.getClass().getSimpleName());
            throw new IllegalStateException("OpenAI 이미지 생성에 실패했습니다.");
        }
    }

    /** 결과 개수·Base64·PNG 시그니처와 실제 디코딩을 확인한다. URL 응답으로 대체하지 않는다. */
    private byte[] decodePng(String response) {
        if (!StringUtils.hasText(response)) throw new IllegalStateException("빈 이미지 생성 응답입니다.");
        JsonNode data = jsonMapper.readTree(response).path("data");
        if (!data.isArray() || data.size() != 1) throw new IllegalStateException("생성 결과는 한 장이어야 합니다.");
        JsonNode encoded = data.path(0).path("b64_json");
        if (!encoded.isString() || encoded.asString().isBlank()
                || encoded.asString().length() > ((ImageValidator.MAX_IMAGE_SIZE_BYTES + 2) / 3) * 4) {
            throw new IllegalStateException("생성 이미지가 비어 있거나 허용 크기를 초과했습니다.");
        }
        byte[] bytes = Base64.getDecoder().decode(encoded.asString());
        if (bytes.length > ImageValidator.MAX_IMAGE_SIZE_BYTES || bytes.length < PNG_SIGNATURE.length
                || !Arrays.equals(bytes, 0, PNG_SIGNATURE.length, PNG_SIGNATURE, 0, PNG_SIGNATURE.length)) {
            throw new IllegalStateException("생성 결과가 PNG가 아닙니다.");
        }
        try (ByteArrayInputStream input = new ByteArrayInputStream(bytes)) {
            BufferedImage image = ImageIO.read(input);
            if (image == null) throw new IllegalStateException("생성 이미지를 읽을 수 없습니다.");
            image.flush();
            return bytes;
        } catch (IOException exception) {
            throw new IllegalStateException("생성 이미지를 읽을 수 없습니다.");
        }
    }
}
