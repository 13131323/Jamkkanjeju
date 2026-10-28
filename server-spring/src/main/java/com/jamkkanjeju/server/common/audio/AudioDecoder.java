package com.jamkkanjeju.server.common.audio;

import com.jamkkanjeju.server.common.exception.BusinessException;
import com.jamkkanjeju.server.common.exception.ErrorCode;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** 실제 음성 디코딩으로 손상을 검사하고 디코딩된 샘플 수로 재생 시간을 계산한다. */
@Slf4j
@Component
public class AudioDecoder {
    private static final int SAMPLE_RATE = 16_000;
    private static final int BYTES_PER_SAMPLE = 2;
    private final String executable;

    /** Docker의 ffmpeg 또는 로컬에서 지정한 실행 파일을 사용한다. */
    public AudioDecoder(@Value("${app.audio.ffmpeg-path:ffmpeg}") String executable) {
        this.executable = executable;
    }

    /** 30초 이하는 끝까지 검사하고, 초과 파일은 30초를 넘는 샘플까지만 읽어 거절에 필요한 길이를 구한다. */
    public double durationSeconds(byte[] data, ErrorCode invalidAudio) {
        Path directory = null;
        Process process = null;
        try {
            directory = Files.createTempDirectory("tour-audio-");
            Path input = directory.resolve("input");
            Path decoded = directory.resolve("decoded.pcm");
            Path errors = directory.resolve("decode-errors");
            Files.write(input, data);
            process = new ProcessBuilder(executable, "-nostdin", "-hide_banner", "-v", "error", "-xerror",
                    "-err_detect", "explode", "-protocol_whitelist", "file,pipe", "-i", input.toString(),
                    "-map", "0:a:0", "-vn", "-sn", "-dn", "-t", "30.001", "-ac", "1", "-ar", "16000",
                    "-c:a", "pcm_s16le", "-f", "s16le", decoded.toString())
                    .redirectOutput(ProcessBuilder.Redirect.DISCARD).redirectError(errors.toFile()).start();
            // 검증 프로세스가 응답하지 않으면 서버 오류로 처리하고 자식 프로세스·임시 파일을 정리한다.
            if (!process.waitFor(30, TimeUnit.SECONDS)) {
                throw new IllegalStateException("오디오 디코딩 처리 시간이 초과되었습니다.");
            }
            if (process.exitValue() != 0 || !Files.exists(decoded) || Files.size(decoded) == 0 || Files.size(errors) > 0) {
                throw new BusinessException(invalidAudio);
            }
            return Files.size(decoded) / (double) (SAMPLE_RATE * BYTES_PER_SAMPLE);
        } catch (IOException exception) {
            throw new IllegalStateException("오디오 디코더 실행 또는 임시 파일 처리에 실패했습니다.", exception);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("오디오 디코딩 처리가 중단되었습니다.", exception);
        } finally {
            if (process != null && process.isAlive()) {
                process.destroyForcibly();
                try { process.waitFor(5, TimeUnit.SECONDS); }
                catch (InterruptedException exception) { Thread.currentThread().interrupt(); }
            }
            if (directory != null) {
                for (String name : new String[]{"input", "decoded.pcm", "decode-errors"}) {
                    try { Files.deleteIfExists(directory.resolve(name)); }
                    catch (IOException exception) { log.error("오디오 검증 임시 파일 삭제 실패: {}", directory.resolve(name), exception); }
                }
                try { Files.deleteIfExists(directory); }
                catch (IOException exception) { log.error("오디오 검증 임시 폴더 삭제 실패: {}", directory, exception); }
            }
        }
    }
}
