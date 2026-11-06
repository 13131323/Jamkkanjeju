package com.jamkkanjeju.server.domain.mypage.service;

import com.jamkkanjeju.server.common.client.OpenAiClient;
import com.jamkkanjeju.server.common.exception.BusinessException;
import com.jamkkanjeju.server.common.image.ImageValidator;
import com.jamkkanjeju.server.domain.mypage.dto.CreateTravelEndingContentRequest;
import com.jamkkanjeju.server.domain.mypage.dto.CreateTravelEndingContentResponse;
import com.jamkkanjeju.server.domain.mypage.exception.MyPageErrorCode;
import com.jamkkanjeju.server.domain.mypage.service.TravelEndingImageGenerator.Source;
import com.jamkkanjeju.server.domain.mypage.service.TravelEndingImageGenerator.SourceType;
import java.util.ArrayList;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

/** 요청 검증·재료 준비·AI 생성·저장을 순서대로 실행하는 엽서 생성 서비스이다. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TravelEndingContentService {
    private final OpenAiClient openAiClient;
    private final JsonMapper jsonMapper;
    private final ImageValidator imageValidator;
    private final TravelEndingContentPreparation preparation;
    private final TravelEndingImageGenerator generator;
    private final TravelEndingContentWriter writer;

    /** 외부 AI 호출 중 DB 트랜잭션·사용자 잠금을 유지하지 않는다. */
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public CreateTravelEndingContentResponse create(Long userId, CreateTravelEndingContentRequest request) {
        if (!openAiClient.isEnabled()) throw new BusinessException(MyPageErrorCode.TRAVEL_ENDING_DISABLED);
        var selection = request.selections(jsonMapper);
        var photos = request.photos().stream().map(photo -> imageValidator.validate(photo,
                MyPageErrorCode.INVALID_IMAGE_FORMAT, MyPageErrorCode.IMAGE_SIZE_EXCEEDED, MyPageErrorCode.INVALID_IMAGE)).toList();
        var sources = new ArrayList<>(preparation.prepare(userId, selection));
        photos.forEach(photo -> sources.add(new Source(SourceType.USER_PHOTO, null, null, null, null, photo)));
        byte[] generated = generator.generate(sources, request.travelNote());
        return writer.save(userId, generated);
    }
}
