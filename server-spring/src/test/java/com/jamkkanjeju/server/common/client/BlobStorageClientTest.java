package com.jamkkanjeju.server.common.client;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.azure.storage.blob.BlobClient;
import com.azure.storage.blob.BlobContainerClient;
import com.azure.storage.blob.models.BlobErrorCode;
import com.azure.storage.blob.models.BlobStorageException;
import com.azure.storage.blob.options.BlobParallelUploadOptions;
import com.jamkkanjeju.server.common.config.BlobStorageProperties;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

/** Azure SDK만 Mock으로 격리해 업로드 옵션·삭제와 인증 정보 비노출을 검증한다. */
@ExtendWith(MockitoExtension.class)
class BlobStorageClientTest {
    @Mock BlobContainerClient container;
    @Mock BlobClient blob;
    BlobStorageClient client;

    @BeforeEach
    void setUp() {
        client = new BlobStorageClient(new BlobStorageProperties("secret-connection-string", "test-media"));
        ReflectionTestUtils.setField(client, "containerClient", container);
    }

    @Test
    void 원본데이터와_형식_덮어쓰기금지조건을_전달한다() throws Exception {
        when(container.getBlobClient("user/file.png")).thenReturn(blob);
        when(blob.getBlobUrl()).thenReturn("https://example.invalid/test-media/user/file.png");
        byte[] data = {1, 2, 3};
        var result = client.upload(data, "user/file.png", "image/png");
        var options = ArgumentCaptor.forClass(BlobParallelUploadOptions.class);
        verify(blob).uploadWithResponse(options.capture(), isNull(), any());
        var bytes = new java.io.ByteArrayOutputStream();
        for (var buffer : options.getValue().getDataFlux().collectList().block()) {
            byte[] part = new byte[buffer.remaining()];
            buffer.get(part);
            bytes.write(part);
        }
        assertThat(bytes.toByteArray()).containsExactly(data);
        assertThat(options.getValue().getHeaders().getContentType()).isEqualTo("image/png");
        assertThat(options.getValue().getRequestConditions().getIfNoneMatch()).isEqualTo("*");
        assertThat(result.name()).isEqualTo("user/file.png");
        assertThat(result.url()).isEqualTo("https://example.invalid/test-media/user/file.png");
    }

    @Test
    void 지정파일만_삭제하고_이미없어도_성공한다() {
        when(container.getBlobClient("user/file.png")).thenReturn(blob);
        assertThatCode(() -> client.delete("user/file.png")).doesNotThrowAnyException();
        verify(blob).deleteIfExists();
    }

    @Test
    void 설정누락은_네트워크없이_실패한다() {
        var missing = new BlobStorageClient(new BlobStorageProperties("", "test-media"));
        assertThatThrownBy(() -> missing.upload(new byte[]{1}, "file", "image/png"))
                .hasMessageContaining("AZURE_STORAGE_CONNECTION_STRING");
        verifyNoInteractions(container, blob);
    }

    @Test
    void Azure오류는_상태와_코드만_노출한다() {
        when(container.getBlobClient("file")).thenReturn(blob);
        var failure = mock(BlobStorageException.class);
        when(failure.getStatusCode()).thenReturn(403);
        when(failure.getErrorCode()).thenReturn(BlobErrorCode.AUTHENTICATION_FAILED);
        when(blob.uploadWithResponse(any(), isNull(), any())).thenThrow(failure);
        assertThatThrownBy(() -> client.upload(new byte[]{1}, "file", "image/png"))
                .hasMessageContaining("status=403", "AuthenticationFailed").hasNoCause();
    }

    @Test
    void 삭제실패는_인증정보를_전달하지_않는다() {
        when(container.getBlobClient("file")).thenReturn(blob);
        when(blob.deleteIfExists()).thenThrow(new IllegalArgumentException("secret-connection-string?sig=secret"));
        assertThatThrownBy(() -> client.delete("file")).hasMessageContaining("삭제", "IllegalArgumentException")
                .hasMessageNotContaining("secret").hasNoCause();
    }

    @Test
    void 설정객체_출력에서도_연결문자열을_숨긴다() {
        assertThat(new BlobStorageProperties("secret-connection-string", "test-media").toString())
                .contains("***", "test-media").doesNotContain("secret-connection-string");
    }
}
