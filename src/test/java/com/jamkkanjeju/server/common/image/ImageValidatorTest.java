package com.jamkkanjeju.server.common.image;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static com.jamkkanjeju.server.domain.treasurehunt.exception.TreasureHuntErrorCode.*;
import static com.jamkkanjeju.server.domain.treasurehunt.support.PictureFixtures.*;

import com.jamkkanjeju.server.common.exception.BusinessException;
import jakarta.validation.ConstraintViolationException;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.web.multipart.MultipartFile;

/** 실제 이미지 데이터를 사용해 내용 판별·디코딩·크기 제한을 검증한다. */
class ImageValidatorTest {
    private final ImageValidator validator = new ImageValidator();

    @ParameterizedTest
    @ValueSource(strings = {"JPEG", "PNG", "WEBP"})
    void 정상파일은_위조된_메타데이터를_무시하고_원본을_유지한다(String format) {
        byte[] bytes = image(format);
        var result = validate(picture(bytes));
        assertThat(result.data()).containsExactly(bytes);
        assertThat(result.format().name()).isEqualTo(format);
        assertThat(result.format().extension()).isEqualTo(format.equals("JPEG") ? ".jpg" : "." + format.toLowerCase());
        assertThat(result.format().contentType()).isEqualTo("image/" + format.toLowerCase());
    }

    @Test
    void 누락과_빈파일은_공통_검증오류다() throws Exception {
        assertThatThrownBy(() -> validate(null)).isInstanceOf(ConstraintViolationException.class);
        assertThatThrownBy(() -> validate(picture(new byte[0]))).isInstanceOf(ConstraintViolationException.class);
        MultipartFile inaccurate = mock(MultipartFile.class);
        when(inaccurate.getInputStream()).thenReturn(new ByteArrayInputStream(new byte[0]));
        assertThatThrownBy(() -> validate(inaccurate)).isInstanceOf(ConstraintViolationException.class);
    }

    @Test
    void 정확히_천만바이트는_허용하고_한바이트_초과는_거절한다() {
        byte[] atLimit = Arrays.copyOf(image("PNG"), 10_000_000);
        assertThat(validate(picture(atLimit)).data()).hasSize(10_000_000);
        error(picture(Arrays.copyOf(atLimit, 10_000_001)), "IMAGE_SIZE_EXCEEDED");
    }

    @Test
    void 실제_읽은크기도_제한하고_초과하면_스트림을_닫는다() throws Exception {
        var stream = spy(new ByteArrayInputStream(new byte[10_000_001]));
        MultipartFile inaccurate = mock(MultipartFile.class);
        when(inaccurate.getSize()).thenReturn(1L);
        when(inaccurate.getInputStream()).thenReturn(stream);
        error(inaccurate, "IMAGE_SIZE_EXCEEDED");
        verify(stream).close();
    }

    @ParameterizedTest
    @ValueSource(strings = {"GIF89a", "<svg/>", "BM000000", "II*00000", "0000ftypheic", "0000ftypheif", "not-image"})
    void 비허용형식은_형식오류다(String signature) {
        error(picture(signature.getBytes(StandardCharsets.US_ASCII)), "INVALID_IMAGE_FORMAT");
    }

    @ParameterizedTest
    @ValueSource(strings = {"JPEG", "PNG", "WEBP"})
    void 시그니처만_맞고_내용이_손상되면_이미지오류다(String format) {
        error(picture(Arrays.copyOf(image(format), format.equals("WEBP") ? 12 : 10)), "INVALID_IMAGE");
    }

    @Test
    void 잘린_JPEG도_디코딩으로_거절한다() {
        byte[] bytes = image("JPEG");
        error(picture(Arrays.copyOf(bytes, bytes.length - 12)), "INVALID_IMAGE");
    }

    @Test
    void 파일읽기_실패는_서버오류로_전파한다() throws Exception {
        MultipartFile file = mock(MultipartFile.class);
        when(file.getInputStream()).thenThrow(new IOException("읽기 장애"));
        assertThatThrownBy(() -> validate(file)).isInstanceOf(IllegalStateException.class).hasCauseInstanceOf(IOException.class);
    }

    /** 호출 도메인의 오류 코드를 공통 검증기에 전달한다. */
    private ImageValidator.ValidatedImage validate(MultipartFile file) {
        return validator.validate(file, INVALID_IMAGE_FORMAT, IMAGE_SIZE_EXCEEDED, INVALID_IMAGE);
    }

    /** 검증 실패의 도메인 코드를 확인한다. */
    private void error(MultipartFile file, String code) {
        assertThatThrownBy(() -> validate(file)).isInstanceOfSatisfying(BusinessException.class,
                exception -> assertThat(exception.getErrorCode().code()).isEqualTo(code));
    }
}
