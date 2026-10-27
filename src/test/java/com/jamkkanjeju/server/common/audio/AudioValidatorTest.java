package com.jamkkanjeju.server.common.audio;

import static com.jamkkanjeju.server.domain.guestbook.support.GuestbookFixtures.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

import com.jamkkanjeju.server.common.exception.BusinessException;
import com.jamkkanjeju.server.domain.guestbook.exception.GuestbookErrorCode;
import jakarta.validation.ConstraintViolationException;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.Arrays;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.web.multipart.MultipartFile;

/** 실제 오디오 디코딩·재생 시간과 파일 크기를 스토리지 없이 검증한다. */
class AudioValidatorTest {
    final AudioValidator validator = new AudioValidator(new AudioDecoder(ffmpegPath()));
    private AudioValidator.ValidatedAudio validate(MultipartFile file) {
        return validator.validate(file, GuestbookErrorCode.INVALID_AUDIO_FORMAT, GuestbookErrorCode.AUDIO_SIZE_EXCEEDED,
                GuestbookErrorCode.INVALID_AUDIO, GuestbookErrorCode.AUDIO_DURATION_EXCEEDED);
    }

    @ParameterizedTest
    @ValueSource(strings = {"MP3", "MPEG", "AAC", "AAC9", "M4A", "WAV", "OGG", "WEBM"})
    void 실제헤더로_형식과_저장메타데이터를_결정한다(String format) {
        AudioValidator.ValidatedAudio audio = validate(file("audioFile", audio(format)));
        String expected = format.equals("MPEG") ? "MP3" : format.equals("AAC9") ? "AAC" : format;
        assertThat(audio.data()).isEqualTo(audio(format));
        assertThat(audio.format().name()).isEqualTo(expected);
        assertThat(audio.format().extension()).isEqualTo("." + expected.toLowerCase());
        assertThat(audio.format().contentType()).startsWith("audio/");
    }

    @ParameterizedTest
    @ValueSource(strings = {"GIF89a", "RIFF0000WEBP", "ftyp", "unknown"})
    void 허용하지않는_헤더는_개별형식오류다(String header) {
        assertThatThrownBy(() -> validate(file("audioFile", header.getBytes(java.nio.charset.StandardCharsets.US_ASCII))))
                .isInstanceOf(BusinessException.class).extracting("errorCode").isEqualTo(GuestbookErrorCode.INVALID_AUDIO_FORMAT);
    }

    @Test
    void 정확히10MB는_허용하고_초과는_크기정보와_읽는중_모두_차단한다() throws Exception {
        byte[] boundary = wav(1, 10_000_000);
        assertThat(validate(file("audioFile", boundary)).data()).hasSize(10_000_000);
        assertThatThrownBy(() -> validate(file("audioFile", new byte[10_000_001])))
                .extracting("errorCode").isEqualTo(GuestbookErrorCode.AUDIO_SIZE_EXCEEDED);
        MultipartFile inaccurate = mock(MultipartFile.class);
        when(inaccurate.getSize()).thenReturn(1L);
        when(inaccurate.getInputStream()).thenReturn(new ByteArrayInputStream(new byte[10_000_001]));
        assertThatThrownBy(() -> validate(inaccurate)).extracting("errorCode").isEqualTo(GuestbookErrorCode.AUDIO_SIZE_EXCEEDED);
    }

    @Test
    void 정확히30초는_허용하고_초과는_개별시간오류다() {
        assertThat(validate(file("audioFile", wav(30, 0))).format()).isEqualTo(AudioValidator.AudioFormat.WAV);
        assertThatThrownBy(() -> validate(file("audioFile", wav(30.001, 0))))
                .extracting("errorCode").isEqualTo(GuestbookErrorCode.AUDIO_DURATION_EXCEEDED);
    }

    @ParameterizedTest
    @ValueSource(strings = {"WAV", "M4A", "MP3"})
    void 헤더만_남은_손상파일은_개별손상오류다(String format) {
        byte[] data = audio(format);
        assertThatThrownBy(() -> validate(file("audioFile", Arrays.copyOf(data, format.equals("WAV") ? 44 : 16))))
                .extracting("errorCode").isEqualTo(GuestbookErrorCode.INVALID_AUDIO);
    }

    @Test
    void 오디오없는컨테이너는_손상오류이고_디코더미설치는_서버오류다() {
        assertThatThrownBy(() -> validate(file("audioFile", audioResource("no-audio.m4a"))))
                .extracting("errorCode").isEqualTo(GuestbookErrorCode.INVALID_AUDIO);
        assertThatThrownBy(() -> new AudioDecoder("missing-tour-ffmpeg-executable").durationSeconds(audio("WAV"), GuestbookErrorCode.INVALID_AUDIO))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void 누락_빈파일_빈스트림과_읽기실패를_구분한다() throws Exception {
        assertThatThrownBy(() -> validate(null)).isInstanceOf(ConstraintViolationException.class);
        assertThatThrownBy(() -> validate(file("audioFile", new byte[0]))).isInstanceOf(ConstraintViolationException.class);
        MultipartFile inaccurate = mock(MultipartFile.class);
        when(inaccurate.getInputStream()).thenReturn(new ByteArrayInputStream(new byte[0]));
        assertThatThrownBy(() -> validate(inaccurate)).isInstanceOf(ConstraintViolationException.class);
        when(inaccurate.getInputStream()).thenThrow(new IOException("read failed"));
        assertThatThrownBy(() -> validate(inaccurate)).isInstanceOf(IllegalStateException.class).hasCauseInstanceOf(IOException.class);
    }
}
