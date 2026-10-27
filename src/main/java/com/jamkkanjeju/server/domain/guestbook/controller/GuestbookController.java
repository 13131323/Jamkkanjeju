package com.jamkkanjeju.server.domain.guestbook.controller;

import com.jamkkanjeju.server.domain.auth.security.AuthUser;
import com.jamkkanjeju.server.domain.guestbook.dto.CreateGuestbookRequest;
import com.jamkkanjeju.server.domain.guestbook.dto.CreateGuestbookResponse;
import com.jamkkanjeju.server.domain.guestbook.service.GuestbookService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.ConstraintViolationException;
import jakarta.validation.Valid;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.InitBinder;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartHttpServletRequest;

/** 방명록 multipart 요청을 검증하고 인증 사용자와 함께 서비스에 전달한다. */
@Tag(name = "guestbook")
@RestController
@RequestMapping("/api/v2/guestbooks")
@RequiredArgsConstructor
public class GuestbookController {
    private final GuestbookService guestbookService;

    /** 단일 파일로 바인딩되기 전에 같은 파일 필드로 여러 첨부를 보내는 요청을 거절한다. */
    @InitBinder
    public void validateFileCount(MultipartHttpServletRequest request) {
        if (request.getFiles("imageFile").size() > 1 || request.getFiles("audioFile").size() > 1) {
            throw new ConstraintViolationException("이미지와 오디오는 각각 한 개만 첨부할 수 있습니다.", Set.of());
        }
    }

    /** 새 일반·길바닥 방명록을 저장하고 실제 저장된 내용을 반환한다. */
    @Operation(summary = "방명록 작성")
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public CreateGuestbookResponse createGuestbook(@AuthenticationPrincipal AuthUser authUser,
                                                   @Valid @ModelAttribute CreateGuestbookRequest request) {
        return guestbookService.createGuestbook(authUser.userId(), request);
    }
}
