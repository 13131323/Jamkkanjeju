package com.jamkkanjeju.server.domain.treasurehunt.dto;

import jakarta.validation.constraints.NotNull;
import org.springframework.web.multipart.MultipartFile;

/** AR 캐릭터와 사진 저장 요청. multipart로 전송한 사진 파일 한 개를 담는다. */
public record SavePictureWithCharacterRequest(
        @NotNull MultipartFile picture
) {
}
