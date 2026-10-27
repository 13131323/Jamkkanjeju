package com.jamkkanjeju.server.common.audio;

import com.jamkkanjeju.server.common.exception.BusinessException;
import com.jamkkanjeju.server.common.exception.ErrorCode;
import jakarta.validation.ConstraintViolationException;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

/** 오디오의 크기·실제 형식·디코딩·재생 시간을 검증하며 오류 코드는 호출 도메인에서 받는다. */
@Component
@RequiredArgsConstructor
public class AudioValidator {
    public static final int MAX_AUDIO_SIZE_BYTES = 10_000_000;
    public static final int MAX_AUDIO_DURATION_SECONDS = 30;
    private final AudioDecoder audioDecoder;

    /** 제한된 크기로 읽고 실제 형식에 맞는 원본 데이터와 저장 메타데이터를 반환한다. */
    public ValidatedAudio validate(MultipartFile file, ErrorCode invalidFormat, ErrorCode sizeExceeded,
                                   ErrorCode invalidAudio, ErrorCode durationExceeded) {
        if (file == null || file.isEmpty()) {
            throw new ConstraintViolationException("오디오 파일은 비어 있을 수 없습니다.", Set.of());
        }
        if (file.getSize() > MAX_AUDIO_SIZE_BYTES) {
            throw new BusinessException(sizeExceeded);
        }
        byte[] data = read(file, sizeExceeded);
        AudioFormat format = detect(data);
        if (format == null) {
            throw new BusinessException(invalidFormat);
        }
        double durationSeconds = audioDecoder.durationSeconds(data, invalidAudio);
        if (durationSeconds > MAX_AUDIO_DURATION_SECONDS) {
            throw new BusinessException(durationExceeded);
        }
        return new ValidatedAudio(data, format);
    }

    /** 요청의 크기 정보만 믿지 않고 읽는 동안에도 최대 10MB를 적용한다. */
    private byte[] read(MultipartFile file, ErrorCode sizeExceeded) {
        try (InputStream input = file.getInputStream(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int total = 0;
            int length;
            while ((length = input.read(buffer)) != -1) {
                if (length > MAX_AUDIO_SIZE_BYTES - total) {
                    throw new BusinessException(sizeExceeded);
                }
                output.write(buffer, 0, length);
                total += length;
            }
            if (total == 0) {
                throw new ConstraintViolationException("오디오 파일이 비어 있습니다.", Set.of());
            }
            return output.toByteArray();
        } catch (IOException exception) {
            throw new IllegalStateException("업로드한 오디오 파일을 읽을 수 없습니다.", exception);
        }
    }

    /** 기존 FastAPI와 같은 ADTS·MPEG·컨테이너 헤더 기준을 사용하고 파일명과 Content-Type은 신뢰하지 않는다. */
    private AudioFormat detect(byte[] data) {
        if (data.length >= 2 && (data[0] & 0xff) == 0xff) {
            int second = data[1] & 0xff;
            if (second == 0xf1 || second == 0xf9) return AudioFormat.AAC;
            if ((second & 0xe0) == 0xe0) return AudioFormat.MP3;
        }
        if (matches(data, 0, "ID3")) return AudioFormat.MP3;
        if (matches(data, 0, "RIFF") && matches(data, 8, "WAVE")) return AudioFormat.WAV;
        if (matches(data, 0, "OggS")) return AudioFormat.OGG;
        if (data.length >= 4 && (data[0] & 0xff) == 0x1a && (data[1] & 0xff) == 0x45
                && (data[2] & 0xff) == 0xdf && (data[3] & 0xff) == 0xa3) return AudioFormat.WEBM;
        if (data.length >= 12 && matches(data, 4, "ftyp")) return AudioFormat.M4A;
        return null;
    }

    /** 지정한 위치에 ASCII 컨테이너 표식이 있는지 데이터 범위 안에서 확인한다. */
    private boolean matches(byte[] data, int offset, String marker) {
        byte[] signature = marker.getBytes(StandardCharsets.US_ASCII);
        return data.length >= offset + signature.length
                && Arrays.equals(data, offset, offset + signature.length, signature, 0, signature.length);
    }

    /** 검증된 원본 오디오와 실제 형식이다. */
    public record ValidatedAudio(byte[] data, AudioFormat format) {
    }

    /** 실제 형식에 맞춰 Blob에 설정하는 확장자와 Content-Type이다. */
    public enum AudioFormat {
        MP3(".mp3", "audio/mpeg"), M4A(".m4a", "audio/mp4"), AAC(".aac", "audio/aac"),
        WAV(".wav", "audio/wav"), OGG(".ogg", "audio/ogg"), WEBM(".webm", "audio/webm");

        private final String extension;
        private final String contentType;

        AudioFormat(String extension, String contentType) {
            this.extension = extension;
            this.contentType = contentType;
        }

        /** 저장할 파일 확장자이다. */
        public String extension() { return extension; }

        /** Blob에 설정할 실제 오디오 Content-Type이다. */
        public String contentType() { return contentType; }
    }
}
