package com.jamkkanjeju.server.domain.guestbook.support;

import com.jamkkanjeju.server.domain.guestbook.dto.CreateGuestbookRequest;
import java.nio.charset.StandardCharsets;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.io.IOException;
import java.io.InputStream;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import org.springframework.mock.web.MockMultipartFile;

/** 방명록 테스트의 고정 날짜·시각과 요청·첨부 데이터를 제공한다. */
public final class GuestbookFixtures {
    public static final Clock CLOCK = Clock.fixed(Instant.parse("2026-10-27T03:00:00Z"), ZoneOffset.UTC);
    public static final LocalDate DATE = LocalDate.of(2026, 10, 1);
    public static final LocalDateTime NOW = LocalDateTime.of(2026, 10, 27, 12, 0);
    private GuestbookFixtures() { }

    /** 선택 콘텐츠가 없는 일반 또는 길바닥 요청이다. */
    public static CreateGuestbookRequest request(String type, Long missionId) {
        boolean general = "GENERAL".equals(type);
        return new CreateGuestbookRequest(type, general ? 39L : null, general ? null : "바다 앞",
                general ? null : 33.0, general ? null : 126.0, DATE, null, null, null, null, null, null, null, missionId);
    }

    /** 실제 내용과 다른 파일명·Content-Type으로 내용 기반 판별을 확인한다. */
    public static MockMultipartFile file(String field, byte[] data) {
        return new MockMultipartFile(field, "untrusted.txt", "application/octet-stream", data);
    }

    /** FFmpeg로 생성한 재생 가능한 고정 오디오를 읽는다. */
    public static byte[] audio(String format) {
        String name = format.equals("MPEG") ? "mpeg.mp3" : "valid." + (format.equals("AAC9") ? "aac" : format.toLowerCase());
        byte[] data = audioResource(name);
        if (format.equals("AAC9")) data[1] = (byte) 0xf9;
        return data;
    }

    /** 디코더가 없는 로컬 실행은 환경변수로 명시한 실행 파일을 사용한다. */
    public static String ffmpegPath() {
        String path = System.getenv("FFMPEG_PATH");
        return path == null || path.isBlank() ? "ffmpeg" : path;
    }

    /** 검증할 원본 리소스를 매번 새 바이트 배열로 읽는다. */
    public static byte[] audioResource(String name) {
        try (InputStream input = GuestbookFixtures.class.getResourceAsStream("/audio/" + name)) {
            if (input == null) throw new IllegalStateException("오디오 테스트 리소스 없음: " + name);
            return input.readAllBytes();
        } catch (IOException exception) { throw new IllegalStateException(exception); }
    }

    /** PCM 샘플 수로 길이를 고정하고 JUNK 청크로 파일 크기만 늘린 정상 WAV를 만든다. */
    public static byte[] wav(double seconds, int totalBytes) {
        int dataSize = (int) Math.round(seconds * 8000) * 2;
        int size = totalBytes == 0 ? 44 + dataSize : totalBytes;
        int padding = size - 44 - dataSize;
        if (padding != 0 && padding < 8) throw new IllegalArgumentException("WAV 패딩이 너무 작습니다.");
        ByteBuffer buffer = ByteBuffer.allocate(size).order(ByteOrder.LITTLE_ENDIAN);
        buffer.put("RIFF".getBytes(StandardCharsets.US_ASCII)).putInt(size - 8).put("WAVEfmt ".getBytes(StandardCharsets.US_ASCII));
        buffer.putInt(16).putShort((short) 1).putShort((short) 1).putInt(8000).putInt(16000).putShort((short) 2).putShort((short) 16);
        if (padding > 0) { buffer.put("JUNK".getBytes(StandardCharsets.US_ASCII)).putInt(padding - 8); buffer.position(buffer.position() + padding - 8); }
        buffer.put("data".getBytes(StandardCharsets.US_ASCII)).putInt(dataSize);
        return buffer.array();
    }
}
