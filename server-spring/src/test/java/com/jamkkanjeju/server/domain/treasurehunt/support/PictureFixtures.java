package com.jamkkanjeju.server.domain.treasurehunt.support;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Base64;
import javax.imageio.ImageIO;
import org.springframework.mock.web.MockMultipartFile;

/** 디코딩 가능한 작은 고정 이미지와 multipart 사진 파일을 제공한다. */
public final class PictureFixtures {
    private PictureFixtures() {
    }

    /** JPEG·PNG는 고정 픽셀로 생성하고 WebP는 고정된 1x1 이미지 바이트를 사용한다. */
    public static byte[] image(String format) {
        if ("WEBP".equals(format)) {
            return Base64.getDecoder().decode("UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA");
        }
        try (var output = new ByteArrayOutputStream()) {
            BufferedImage image = new BufferedImage(2, 2, BufferedImage.TYPE_INT_RGB);
            image.setRGB(0, 0, 0xff0000);
            image.setRGB(1, 1, 0x0000ff);
            if (!ImageIO.write(image, format, output)) throw new IllegalStateException("이미지 작성기 없음: " + format);
            return output.toByteArray();
        } catch (IOException exception) {
            throw new IllegalStateException(exception);
        }
    }

    /** 파일명과 Content-Type을 실제 형식과 다르게 보내 내용 기반 검증을 확인한다. */
    public static MockMultipartFile picture(byte[] bytes) {
        return new MockMultipartFile("picture", "untrusted.jpeg", "application/octet-stream", bytes);
    }
}
