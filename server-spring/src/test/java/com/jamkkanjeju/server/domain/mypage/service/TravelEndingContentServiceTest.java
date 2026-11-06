package com.jamkkanjeju.server.domain.mypage.service;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.jamkkanjeju.server.common.client.OpenAiClient;
import com.jamkkanjeju.server.common.exception.BusinessException;
import com.jamkkanjeju.server.common.image.ImageValidator;
import com.jamkkanjeju.server.common.image.ImageValidator.ImageFormat;
import com.jamkkanjeju.server.common.image.ImageValidator.ValidatedImage;
import com.jamkkanjeju.server.domain.mypage.dto.CreateTravelEndingContentRequest;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import tools.jackson.databind.json.JsonMapper;

/** 비활성 또는 생성 실패 시 후속 저장이 실행되지 않는지 검증한다. */
class TravelEndingContentServiceTest {
    private final OpenAiClient ai = mock(OpenAiClient.class);
    private final ImageValidator images = mock(ImageValidator.class);
    private final TravelEndingContentPreparation preparation = mock(TravelEndingContentPreparation.class);
    private final TravelEndingImageGenerator generator = mock(TravelEndingImageGenerator.class);
    private final TravelEndingContentWriter writer = mock(TravelEndingContentWriter.class);
    private final TravelEndingContentService service = new TravelEndingContentService(ai,
            JsonMapper.builder().build(), images, preparation, generator, writer);

    @Test
    void 비활성은잘못된요청도처리하지않고503으로중단한다() {
        assertThatThrownBy(() -> service.create(1L, null)).isInstanceOfSatisfying(BusinessException.class,
                exception -> assertThat(exception.getErrorCode().code()).isEqualTo("TRAVEL_ENDING_DISABLED"));
        verifyNoInteractions(images, preparation, generator, writer);
    }

    @Test
    void 생성실패시저장과차감은호출하지않는다() {
        when(ai.isEnabled()).thenReturn(true);
        when(images.validate(any(org.springframework.web.multipart.MultipartFile.class), any(), any(), any()))
                .thenReturn(new ValidatedImage(new byte[]{1}, ImageFormat.PNG));
        when(preparation.prepare(anyLong(), any())).thenReturn(List.of());
        when(generator.generate(anyList(), any())).thenThrow(new IllegalStateException("failed"));
        var request = new CreateTravelEndingContentRequest("[1]", "[1]",
                List.of(new MockMultipartFile("photos", new byte[]{1})), null);
        assertThatThrownBy(() -> service.create(1L, request)).isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(writer);
    }
}
