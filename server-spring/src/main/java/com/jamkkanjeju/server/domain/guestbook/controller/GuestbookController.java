package com.jamkkanjeju.server.domain.guestbook.controller;

import com.jamkkanjeju.server.domain.auth.security.AuthUser;
import com.jamkkanjeju.server.domain.guestbook.dto.CreateGuestbookRequest;
import com.jamkkanjeju.server.domain.guestbook.dto.CreateGuestbookResponse;
import com.jamkkanjeju.server.domain.guestbook.dto.GetGuestbooksRequest;
import com.jamkkanjeju.server.domain.guestbook.dto.GetGuestbooksResponse;
import com.jamkkanjeju.server.domain.guestbook.dto.ToggleGuestbookLikeResponse;
import com.jamkkanjeju.server.domain.guestbook.service.GuestbookService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.ConstraintViolationException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.InitBinder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartHttpServletRequest;
import org.springframework.web.util.WebUtils;

/** 방명록 조회·작성 요청을 검증하고 인증 사용자와 함께 서비스에 전달한다. */
@Tag(name = "guestbook")
@RestController
@RequestMapping("/api/v2/guestbooks")
@RequiredArgsConstructor
public class GuestbookController {
    private final GuestbookService guestbookService;

    /** 단일 파일로 바인딩되기 전에 같은 파일 필드로 여러 첨부를 보내는 요청을 거절한다. */
    @InitBinder
    public void validateFileCount(HttpServletRequest request) {
        MultipartHttpServletRequest multipartRequest = WebUtils.getNativeRequest(request, MultipartHttpServletRequest.class);
        if (multipartRequest != null
                && (multipartRequest.getFiles("imageFile").size() > 1
                || multipartRequest.getFiles("audioFile").size() > 1)) {
            throw new ConstraintViolationException("이미지와 오디오는 각각 한 개만 첨부할 수 있습니다.", Set.of());
        }
    }

    /** 일반·길바닥 방명록의 독립된 페이지와 본인의 방문 장소·좋아요 정보를 반환한다. */
    @Operation(summary = "방명록 조회")
    @GetMapping
    public GetGuestbooksResponse getGuestbooks(@AuthenticationPrincipal AuthUser authUser,
                                               @Valid @ParameterObject @ModelAttribute GetGuestbooksRequest request) {
        return guestbookService.getGuestbooks(authUser.userId(), request);
    }

    /** 인증 사용자의 좋아요를 반전하고 처리 후 상태와 전체 개수를 반환한다. */
    @Operation(summary = "방명록 좋아요 토글")
    @PostMapping("/{guestbookId}/like")
    public ToggleGuestbookLikeResponse toggleGuestbookLike(@AuthenticationPrincipal AuthUser authUser,
                                                          @PathVariable @Positive Long guestbookId) {
        return guestbookService.toggleGuestbookLike(authUser.userId(), guestbookId);
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
