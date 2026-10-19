package com.jamkkanjeju.server.common.image;

import com.jamkkanjeju.server.common.exception.BusinessException;
import com.jamkkanjeju.server.common.exception.ErrorCode;
import jakarta.validation.ConstraintViolationException;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Arrays;
import java.util.Iterator;
import java.util.Set;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.MemoryCacheImageInputStream;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

/** 업로드 이미지의 크기·실제 형식·디코딩을 검증하며 오류 코드는 호출 도메인에서 받는다. */
@Component
public class ImageValidator {
    public static final int MAX_IMAGE_SIZE_BYTES = 10_000_000;
    private static final byte[] JPEG_SIGNATURE = {(byte) 0xff, (byte) 0xd8, (byte) 0xff};
    private static final byte[] PNG_SIGNATURE = {(byte) 0x89, 'P', 'N', 'G', 13, 10, 26, 10};
    private static final byte[] RIFF_SIGNATURE = {'R', 'I', 'F', 'F'};
    private static final byte[] WEBP_SIGNATURE = {'W', 'E', 'B', 'P'};

    /** 제한된 크기로 읽고 시그니처와 실제 디코딩을 확인한 원본 데이터를 반환한다. */
    public ValidatedImage validate(MultipartFile file, ErrorCode invalidFormat, ErrorCode sizeExceeded,
                                   ErrorCode invalidImage) {
        if (file == null || file.isEmpty()) {
            throw new ConstraintViolationException("사진 파일은 필수이며 비어 있을 수 없습니다.", Set.of());
        }
        if (file.getSize() > MAX_IMAGE_SIZE_BYTES) {
            throw new BusinessException(sizeExceeded);
        }
        byte[] data = read(file, sizeExceeded);
        ImageFormat format = detect(data);
        if (format == null) {
            throw new BusinessException(invalidFormat);
        }
        decode(data, format, invalidImage);
        return new ValidatedImage(data, format);
    }

    /** 클라이언트의 크기 정보만 믿지 않고 읽는 동안에도 최대 10MB를 적용한다. */
    private byte[] read(MultipartFile file, ErrorCode sizeExceeded) {
        try (InputStream input = file.getInputStream(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int length;
            int total = 0;
            while ((length = input.read(buffer)) != -1) {
                if (length > MAX_IMAGE_SIZE_BYTES - total) {
                    throw new BusinessException(sizeExceeded);
                }
                output.write(buffer, 0, length);
                total += length;
            }
            if (total == 0) {
                throw new ConstraintViolationException("사진 파일이 비어 있습니다.", Set.of());
            }
            return output.toByteArray();
        } catch (IOException exception) {
            throw new IllegalStateException("업로드한 이미지 파일을 읽을 수 없습니다.", exception);
        }
    }

    /** 파일명·요청 Content-Type 대신 파일 내용으로 허용 형식을 판별한다. */
    private ImageFormat detect(byte[] data) {
        if (startsWith(data, JPEG_SIGNATURE, 0)) return ImageFormat.JPEG;
        if (startsWith(data, PNG_SIGNATURE, 0)) return ImageFormat.PNG;
        if (data.length >= 12 && startsWith(data, RIFF_SIGNATURE, 0) && startsWith(data, WEBP_SIGNATURE, 8)) {
            return ImageFormat.WEBP;
        }
        return null;
    }

    /** 지정한 위치의 시그니처를 데이터 범위 안에서 비교한다. */
    private boolean startsWith(byte[] data, byte[] signature, int offset) {
        return data.length >= offset + signature.length
                && Arrays.equals(data, offset, offset + signature.length, signature, 0, signature.length);
    }

    /** 헤더뿐 아니라 이미지 픽셀을 읽고, 잘린 데이터의 디코더 경고도 손상으로 처리한다. */
    private void decode(byte[] data, ImageFormat format, ErrorCode invalidImage) {
        Iterator<ImageReader> readers = ImageIO.getImageReadersByFormatName(format.name());
        if (!readers.hasNext()) {
            throw new IllegalStateException("이미지 디코더가 설정되지 않았습니다: " + format.name());
        }
        ImageReader reader = readers.next();
        try (var input = new MemoryCacheImageInputStream(new ByteArrayInputStream(data))) {
            boolean[] warned = {false};
            reader.addIIOReadWarningListener((source, warning) -> warned[0] = true);
            reader.setInput(input);
            int count = reader.getNumImages(true);
            if (count < 1) throw new BusinessException(invalidImage);
            for (int index = 0; index < count; index++) {
                BufferedImage image = reader.read(index);
                if (image == null) throw new BusinessException(invalidImage);
                image.flush();
            }
            if (warned[0]) throw new BusinessException(invalidImage);
        } catch (IOException | RuntimeException exception) {
            if (exception instanceof BusinessException businessException) {
                throw businessException;
            }
            throw new BusinessException(invalidImage);
        } finally {
            reader.dispose();
        }
    }

    /** 검증된 원본 파일과 저장 확장자·Content-Type의 기준이 되는 실제 형식이다. */
    public record ValidatedImage(byte[] data, ImageFormat format) {
    }

    /** 허용 이미지 형식과 실제 형식에 따른 저장 메타데이터이다. */
    public enum ImageFormat {
        JPEG(".jpg", "image/jpeg"), PNG(".png", "image/png"), WEBP(".webp", "image/webp");

        private final String extension;
        private final String contentType;

        ImageFormat(String extension, String contentType) {
            this.extension = extension;
            this.contentType = contentType;
        }

        /** 저장할 파일 확장자이다. JPEG는 .jpg로 통일한다. */
        public String extension() { return extension; }

        /** Blob에 설정할 실제 이미지 Content-Type이다. */
        public String contentType() { return contentType; }
    }
}
