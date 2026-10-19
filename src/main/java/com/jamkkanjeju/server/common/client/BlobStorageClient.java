package com.jamkkanjeju.server.common.client;

import com.azure.core.util.BinaryData;
import com.azure.core.util.Context;
import com.azure.storage.blob.BlobClient;
import com.azure.storage.blob.BlobContainerClient;
import com.azure.storage.blob.BlobServiceClientBuilder;
import com.azure.storage.blob.models.BlobHttpHeaders;
import com.azure.storage.blob.models.BlobRequestConditions;
import com.azure.storage.blob.models.BlobStorageException;
import com.azure.storage.blob.models.PublicAccessType;
import com.azure.storage.blob.options.BlobContainerCreateOptions;
import com.azure.storage.blob.options.BlobParallelUploadOptions;
import com.jamkkanjeju.server.common.config.BlobStorageProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/** 검증된 파일의 Azure Blob 업로드와 저장 실패 시 파일 삭제를 담당하는 공통 클라이언트이다. */
@Component
@RequiredArgsConstructor
public class BlobStorageClient {
    private final BlobStorageProperties properties;
    private BlobContainerClient containerClient;

    /** 지정한 새 Blob에 원본 데이터를 올리고, 저장에 사용할 Blob 이름과 접근 URL을 반환한다. */
    public UploadedBlob upload(byte[] data, String blobName, String contentType) {
        try {
            BlobClient blob = containerClient().getBlobClient(blobName);
            BlobParallelUploadOptions options = new BlobParallelUploadOptions(BinaryData.fromBytes(data))
                    .setHeaders(new BlobHttpHeaders().setContentType(contentType))
                    .setRequestConditions(new BlobRequestConditions().setIfNoneMatch("*"));
            blob.uploadWithResponse(options, null, Context.NONE);
            return new UploadedBlob(blobName, blob.getBlobUrl());
        } catch (RuntimeException exception) {
            throw storageFailure("업로드", exception);
        }
    }

    /** 이 컨테이너에서 업로드한 이름으로 파일을 삭제한다. 이미 없는 파일은 그대로 둔다. */
    public void delete(String blobName) {
        try {
            containerClient().getBlobClient(blobName).deleteIfExists();
        } catch (RuntimeException exception) {
            throw storageFailure("삭제", exception);
        }
    }

    /** 최초 파일 요청 때만 연결하고, 기존 FastAPI처럼 없는 컨테이너는 Blob 공개 읽기로 생성한다. */
    private synchronized BlobContainerClient containerClient() {
        if (containerClient == null) {
            if (properties.connectionString() == null || properties.connectionString().isBlank()) {
                throw new IllegalStateException("AZURE_STORAGE_CONNECTION_STRING이 설정되지 않았습니다.");
            }
            BlobContainerClient client = new BlobServiceClientBuilder()
                    .connectionString(properties.connectionString())
                    .buildClient()
                    .getBlobContainerClient(properties.container());
            client.createIfNotExistsWithResponse(
                    new BlobContainerCreateOptions().setPublicAccessType(PublicAccessType.BLOB), null, Context.NONE);
            containerClient = client;
        }
        return containerClient;
    }

    /** SDK 오류에 인증 정보가 포함되지 않도록 작업·오류 종류·Azure 오류 코드만 전달한다. */
    private IllegalStateException storageFailure(String operation, RuntimeException exception) {
        if (exception instanceof IllegalStateException stateException
                && "AZURE_STORAGE_CONNECTION_STRING이 설정되지 않았습니다.".equals(exception.getMessage())) {
            return stateException;
        }
        String detail = exception instanceof BlobStorageException storageException
                ? "status=" + storageException.getStatusCode() + ", code=" + storageException.getErrorCode()
                : "type=" + exception.getClass().getSimpleName();
        return new IllegalStateException("Azure Blob " + operation + " 실패: " + detail);
    }

    /** 업로드한 파일의 삭제용 이름과 DB 저장용 접근 URL이다. */
    public record UploadedBlob(String name, String url) {
    }
}
