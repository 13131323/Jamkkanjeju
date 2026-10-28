package com.jamkkanjeju.server.common.client;

import com.jamkkanjeju.server.common.client.BlobStorageClient.UploadedBlob;
import lombok.extern.slf4j.Slf4j;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/** DB 롤백 시 이번 요청에서 업로드한 Blob만 정리하는 공통 트랜잭션 도우미이다. */
@Slf4j
public final class BlobRollbackCleanup {
    private BlobRollbackCleanup() { }

    /** 커밋 시점 실패까지 추적할 수 있도록 업로드 전에 활성 트랜잭션을 확인한다. */
    public static void requireActiveTransaction() {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            throw new IllegalStateException("사진 저장에는 활성 트랜잭션이 필요합니다.");
        }
    }

    /** 업로드한 Blob의 롤백 삭제를 등록한다. context에는 사용자·팀 등 비밀정보가 아닌 식별자만 전달한다. */
    public static void register(BlobStorageClient client, UploadedBlob uploaded, String context) {
        requireActiveTransaction();
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
                if (status == STATUS_COMMITTED) {
                    return;
                }
                if (status != STATUS_ROLLED_BACK) {
                    // 결과가 불명확하면 정상 DB 행이 참조할 수 있는 파일을 임의로 삭제하지 않는다.
                    log.error("사진 트랜잭션 결과 확인 필요: {}, blobName={}, status={}", context, uploaded.name(), status);
                    return;
                }
                log.warn("사진 저장 롤백으로 업로드 파일 삭제: {}, blobName={}", context, uploaded.name());
                try {
                    client.delete(uploaded.name());
                } catch (RuntimeException exception) {
                    // 정리 실패로 원래 저장·커밋 오류를 덮어쓰지 않는다.
                    log.error("사진 롤백 파일 삭제 실패: {}, blobName={}", context, uploaded.name(), exception);
                }
            }
        });
    }
}
