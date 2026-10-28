package com.jamkkanjeju.server.common.client;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/** DB 종료 결과에 따른 이번 업로드 파일의 정리만 검증한다. */
class BlobRollbackCleanupTest {
    @AfterEach void clear() {
        if(TransactionSynchronizationManager.isSynchronizationActive())TransactionSynchronizationManager.clearSynchronization();
    }
    @Test void 트랜잭션없이는_업로드준비와_등록을_거부한다() {
        assertThatIllegalStateException().isThrownBy(BlobRollbackCleanup::requireActiveTransaction);
        assertThatIllegalStateException().isThrownBy(() -> BlobRollbackCleanup.register(
                mock(BlobStorageClient.class),new BlobStorageClient.UploadedBlob("new","url"),"test"));
    }
    @ParameterizedTest @ValueSource(ints={0,1,2})
    void 롤백일때만_이번파일을_삭제한다(int status) {
        TransactionSynchronizationManager.initSynchronization();
        var storage=mock(BlobStorageClient.class);
        BlobRollbackCleanup.register(storage,new BlobStorageClient.UploadedBlob("new","url"),"test");
        TransactionSynchronizationManager.getSynchronizations().forEach(s -> s.afterCompletion(status));
        if(status==1)verify(storage).delete("new"); else verifyNoInteractions(storage);
    }
    @Test void 삭제실패는_원래오류를_덮지않는다() {
        TransactionSynchronizationManager.initSynchronization();
        var storage=mock(BlobStorageClient.class);
        doThrow(new IllegalStateException("삭제 실패")).when(storage).delete("new");
        BlobRollbackCleanup.register(storage,new BlobStorageClient.UploadedBlob("new","url"),"test");
        assertThatCode(() -> TransactionSynchronizationManager.getSynchronizations().forEach(s -> s.afterCompletion(1)))
                .doesNotThrowAnyException();
    }
}
