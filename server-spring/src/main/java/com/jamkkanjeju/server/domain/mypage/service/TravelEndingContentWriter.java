package com.jamkkanjeju.server.domain.mypage.service;

import com.jamkkanjeju.server.common.client.BlobRollbackCleanup;
import com.jamkkanjeju.server.common.client.BlobStorageClient;
import com.jamkkanjeju.server.common.exception.BusinessException;
import com.jamkkanjeju.server.common.exception.CommonErrorCode;
import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.auth.repository.UserRepository;
import com.jamkkanjeju.server.domain.etc.entity.TravelEndingContent;
import com.jamkkanjeju.server.domain.etc.repository.TravelEndingContentRepository;
import com.jamkkanjeju.server.domain.mypage.dto.CreateTravelEndingContentResponse;
import com.jamkkanjeju.server.domain.mypage.exception.MyPageErrorCode;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 생성 후에만 사용자 잠금을 잡고 잔액 재검사·Blob·DB 저장을 처리한다. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TravelEndingContentWriter {
    public static final int CREATION_POINT_COST = 100;
    private final UserRepository userRepository;
    private final TravelEndingContentRepository contentRepository;
    private final BlobStorageClient blobStorageClient;
    private final Clock clock;

    /** 포인트 차감과 엽서 행을 함께 커밋하며 실패 시 업로드한 Blob을 정리한다. */
    @Transactional
    public CreateTravelEndingContentResponse save(Long userId, byte[] image) {
        User user = userRepository.findByIdForUpdate(userId)
                .orElseThrow(() -> new BusinessException(CommonErrorCode.UNAUTHORIZED));
        if (user.getPoint() < CREATION_POINT_COST) throw new BusinessException(MyPageErrorCode.INSUFFICIENT_POINT);
        BlobRollbackCleanup.requireActiveTransaction();
        String name = "travel-ending/" + userId + "/" + UUID.randomUUID() + ".png";
        var uploaded = blobStorageClient.upload(image, name, "image/png");
        BlobRollbackCleanup.register(blobStorageClient, uploaded, "travel-ending userId=" + userId);
        user.spendPoint(CREATION_POINT_COST);
        TravelEndingContent content = contentRepository.saveAndFlush(TravelEndingContent.builder().user(user)
                .imageUrl(uploaded.url()).savedAt(LocalDateTime.now(clock)).build());
        return CreateTravelEndingContentResponse.of(content, user.getPoint());
    }
}
