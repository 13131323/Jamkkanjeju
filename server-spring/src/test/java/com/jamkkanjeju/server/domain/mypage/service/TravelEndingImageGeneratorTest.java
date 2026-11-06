package com.jamkkanjeju.server.domain.mypage.service;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.jamkkanjeju.server.common.client.*;
import com.jamkkanjeju.server.common.image.ImageValidator.ImageFormat;
import com.jamkkanjeju.server.common.image.ImageValidator.ValidatedImage;
import com.jamkkanjeju.server.domain.mypage.service.TravelEndingImageGenerator.Source;
import com.jamkkanjeju.server.domain.mypage.service.TravelEndingImageGenerator.SourceType;
import com.jayway.jsonpath.JsonPath;
import java.util.List;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

/** 실제 원문 리소스의 치환·manifest와 참조 이미지 순서 대응을 검증한다. */
class TravelEndingImageGeneratorTest {
    private final OpenAiClient ai = mock(OpenAiClient.class);
    private final TourApiClient tour = mock(TourApiClient.class);
    private final ReferenceImageClient references = mock(ReferenceImageClient.class);

    @Test
    void 이미지가없는항목은이름을유지하고_이미지번호와사용자텍스트를그대로전달한다() throws Exception {
        var reference = new ValidatedImage(new byte[]{1}, ImageFormat.PNG);
        var photo = new ValidatedImage(new byte[]{2}, ImageFormat.JPEG);
        when(tour.getLocationImageUrl(123L)).thenReturn("https://example.invalid/missing.png");
        when(references.download("https://example.invalid/quiz.png")).thenReturn(reference);
        String note = "{manifest_json} $1 \\ 여행";
        when(ai.editImage(anyString(), anyList())).thenAnswer(invocation -> {
            String prompt = invocation.getArgument(0);
            assertThat(prompt).contains("<travel_note>\n" + note + "\n</travel_note>", "입력에 없는 장소, 미션, 날짜, 문장이나 사실을 새로 만들어 넣지 않는다.");
            String manifest = prompt.substring(prompt.lastIndexOf("<manifest>") + "<manifest>".length(), prompt.lastIndexOf("</manifest>"));
            assertThat(JsonPath.<Object>read(manifest, "$[0].inputImageIndex")).isNull();
            assertThat(JsonPath.<String>read(manifest, "$[0].displayName")).isEqualTo("장소");
            assertThat(JsonPath.<Integer>read(manifest, "$[1].inputImageIndex")).isEqualTo(1);
            assertThat(JsonPath.<Integer>read(manifest, "$[2].inputImageIndex")).isEqualTo(2);
            assertThat(invocation.<List<ValidatedImage>>getArgument(1)).containsExactly(reference, photo);
            return new byte[]{3};
        });
        var generator = new TravelEndingImageGenerator(ai, tour, references, JsonMapper.builder().build());
        assertThat(generator.generate(List.of(
                new Source(SourceType.VISITED_LOCATION, "장소", "장소", 123L, null, null),
                new Source(SourceType.MISSION, "미션", null, null, "https://example.invalid/quiz.png", null),
                new Source(SourceType.USER_PHOTO, null, null, null, null, photo)), note)).containsExactly((byte) 3);
        verify(ai).editImage(anyString(), anyList());
    }

    @Test
    void AI실패는대체이미지없이전파한다() throws Exception {
        var generator = new TravelEndingImageGenerator(ai, tour, references, JsonMapper.builder().build());
        when(ai.editImage(anyString(), anyList())).thenThrow(new IllegalStateException("failed"));
        assertThatThrownBy(() -> generator.generate(List.of(new Source(SourceType.USER_PHOTO, null, null, null, null,
                new ValidatedImage(new byte[]{1}, ImageFormat.PNG))), null)).isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(tour, references);
    }
}
