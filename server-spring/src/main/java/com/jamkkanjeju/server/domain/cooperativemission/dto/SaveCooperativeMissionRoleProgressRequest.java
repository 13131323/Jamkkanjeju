package com.jamkkanjeju.server.domain.cooperativemission.dto;

import jakarta.validation.constraints.NotNull;
import org.springframework.web.multipart.MultipartFile;

/** 본인에게 배정된 역할을 인증할 사진 한 개를 전달하는 multipart 요청이다. */
public record SaveCooperativeMissionRoleProgressRequest(
        @NotNull MultipartFile itemImage
) {
}
