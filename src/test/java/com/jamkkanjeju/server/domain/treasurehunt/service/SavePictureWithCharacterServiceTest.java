package com.jamkkanjeju.server.domain.treasurehunt.service;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static com.jamkkanjeju.server.domain.auth.support.AuthFixtures.activeUser;
import static com.jamkkanjeju.server.domain.treasurehunt.exception.TreasureHuntErrorCode.*;

import com.jamkkanjeju.server.common.client.BlobStorageClient;
import com.jamkkanjeju.server.common.client.BlobStorageClient.UploadedBlob;
import com.jamkkanjeju.server.common.client.TourApiClient;
import com.jamkkanjeju.server.common.exception.BusinessException;
import com.jamkkanjeju.server.common.image.ImageValidator;
import com.jamkkanjeju.server.common.image.ImageValidator.ImageFormat;
import com.jamkkanjeju.server.common.image.ImageValidator.ValidatedImage;
import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.auth.repository.UserRepository;
import com.jamkkanjeju.server.domain.map.service.NextLocationRecommender;
import com.jamkkanjeju.server.domain.mission.service.MissionRewardGranter;
import com.jamkkanjeju.server.domain.mission.service.NextMissionSelector;
import com.jamkkanjeju.server.domain.treasurehunt.dto.SavePictureWithCharacterRequest;
import com.jamkkanjeju.server.domain.treasurehunt.entity.PictureWithCharacter;
import com.jamkkanjeju.server.domain.treasurehunt.repository.*;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import java.time.*;
import java.util.Optional;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.slf4j.LoggerFactory;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/** 외부 시스템 없이 사진 저장 순서와 서버 시각·트랜잭션 종료 시 파일 정리를 검증한다. */
@ExtendWith(MockitoExtension.class)
class SavePictureWithCharacterServiceTest {
    static final Clock CLOCK = Clock.fixed(Instant.parse("2026-10-19T03:00:00Z"), ZoneOffset.UTC);
    @Mock UserRepository users;
    @Mock PictureWithCharacterRepository pictures;
    @Mock ImageValidator validator;
    @Mock BlobStorageClient storage;
    @Mock MissionRewardGranter rewards;
    @Mock TreasureMissionProgressRepository progresses;
    @Mock TreasureMissionProgressItemRepository items;
    @Mock TreasureItemCoordinateGenerator coordinates;
    TreasureMissionService service;
    User user;
    final byte[] data = {1, 2, 3};
    final MockMultipartFile file = new MockMultipartFile("picture", "../../original.jpeg", "image/jpeg", data);
    String uploadedName;

    @BeforeEach
    void setUp() {
        service = new TreasureMissionService(users, mock(TreasureMissionRepository.class), progresses, items, coordinates,
                mock(TourApiClient.class), rewards, mock(NextLocationRecommender.class), mock(NextMissionSelector.class),
                CLOCK, pictures, validator, storage);
        user = activeUser(15L);
        TransactionSynchronizationManager.initSynchronization();
    }

    @AfterEach
    void tearDown() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) TransactionSynchronizationManager.clearSynchronization();
        verifyNoInteractions(rewards, progresses, items, coordinates);
    }

    @Test
    void 순서대로_검증업로드저장하고_KST시각과_새이름을_사용한다() {
        valid();
        uploaded();
        save();
        var record = ArgumentCaptor.forClass(PictureWithCharacter.class);
        var order = inOrder(users, validator, storage, pictures);
        order.verify(users).findById(15L);
        order.verify(validator).validate(file, INVALID_IMAGE_FORMAT, IMAGE_SIZE_EXCEEDED, INVALID_IMAGE);
        order.verify(storage).upload(eq(data), anyString(), eq("image/png"));
        order.verify(pictures).saveAndFlush(record.capture());
        assertThat(uploadedName).matches("ar_character_picture/15/[0-9a-f-]{36}\\.png").doesNotContain("original");
        assertThat(record.getValue().getUser()).isSameAs(user);
        assertThat(record.getValue().getPictureUrl()).isEqualTo("https://example.invalid/" + uploadedName);
        assertThat(record.getValue().getSavedAt()).isEqualTo(LocalDateTime.of(2026, 10, 19, 12, 0));
        complete(TransactionSynchronization.STATUS_COMMITTED);
        verify(storage, never()).delete(anyString());
    }

    @Test
    void 사용자없음은_검증업로드저장_전에_거절한다() {
        assertThatThrownBy(this::save).isInstanceOfSatisfying(BusinessException.class,
                exception -> assertThat(exception.getErrorCode().code()).isEqualTo("UNAUTHORIZED"));
        verifyNoInteractions(validator, storage, pictures);
    }

    @Test
    void 검증실패는_업로드와_저장을_하지_않는다() {
        when(users.findById(15L)).thenReturn(Optional.of(user));
        var failure = new BusinessException(INVALID_IMAGE);
        when(validator.validate(file, INVALID_IMAGE_FORMAT, IMAGE_SIZE_EXCEEDED, INVALID_IMAGE)).thenThrow(failure);
        assertThatThrownBy(this::save).isSameAs(failure);
        verifyNoInteractions(storage, pictures);
    }

    @Test
    void 트랜잭션없이_업로드하지_않는다() {
        valid();
        TransactionSynchronizationManager.clearSynchronization();
        assertThatThrownBy(this::save).isInstanceOf(IllegalStateException.class).hasMessageContaining("트랜잭션");
        verifyNoInteractions(storage, pictures);
    }

    @Test
    void 업로드실패는_DB저장과_파일삭제를_하지_않는다() {
        valid();
        var failure = new IllegalStateException("업로드 실패");
        when(storage.upload(eq(data), anyString(), eq("image/png"))).thenThrow(failure);
        assertThatThrownBy(this::save).isSameAs(failure);
        verifyNoInteractions(pictures);
        verify(storage, never()).delete(anyString());
        assertThat(TransactionSynchronizationManager.getSynchronizations()).isEmpty();
    }

    @Test
    void 저장실패는_원인을_유지하고_롤백때만_해당파일을_삭제한다() {
        valid(); uploaded();
        var failure = new IllegalStateException("최초 DB 실패");
        when(pictures.saveAndFlush(any())).thenThrow(failure);
        assertThatThrownBy(this::save).isSameAs(failure);
        verify(storage, never()).delete(anyString());
        complete(TransactionSynchronization.STATUS_ROLLED_BACK);
        verify(storage).delete(uploadedName);
    }

    @Test
    void 메서드반환후_롤백도_해당파일을_삭제한다() {
        valid(); uploaded(); save();
        complete(TransactionSynchronization.STATUS_ROLLED_BACK);
        verify(storage).delete(uploadedName);
    }

    @Test
    void 삭제실패는_최초저장실패를_덮어쓰지_않는다() {
        valid(); uploaded();
        var failure = new IllegalStateException("최초 DB 실패");
        when(pictures.saveAndFlush(any())).thenThrow(failure);
        assertThatThrownBy(this::save).isSameAs(failure);
        doThrow(new IllegalStateException("삭제 실패")).when(storage).delete(uploadedName);
        Logger logger = (Logger) LoggerFactory.getLogger(TreasureMissionService.class);
        var logs = new ListAppender<ILoggingEvent>();
        logs.start(); logger.addAppender(logs);
        try {
            assertThatCode(() -> complete(TransactionSynchronization.STATUS_ROLLED_BACK)).doesNotThrowAnyException();
            verify(storage).delete(uploadedName);
            assertThat(logs.list).anySatisfy(event -> {
                assertThat(event.getFormattedMessage()).contains("삭제 실패", "userId=15", uploadedName);
                assertThat(event.getThrowableProxy().getMessage()).isEqualTo("삭제 실패");
            });
        } finally {
            logger.detachAppender(logs); logs.stop();
        }
    }

    @Test
    void 커밋상태가_불명확하면_파일을_보존한다() {
        valid(); uploaded(); save();
        Logger logger = (Logger) LoggerFactory.getLogger(TreasureMissionService.class);
        var logs = new ListAppender<ILoggingEvent>();
        logs.start(); logger.addAppender(logs);
        try {
            complete(TransactionSynchronization.STATUS_UNKNOWN);
            verify(storage, never()).delete(anyString());
            assertThat(logs.list).anySatisfy(event -> assertThat(event.getFormattedMessage())
                    .contains("결과 확인 필요", "userId=15", uploadedName));
        } finally {
            logger.detachAppender(logs); logs.stop();
        }
    }

    /** 검증 성공을 고정 형식과 원본 데이터로 준비한다. */
    private void valid() {
        when(users.findById(15L)).thenReturn(Optional.of(user));
        when(validator.validate(file, INVALID_IMAGE_FORMAT, IMAGE_SIZE_EXCEEDED, INVALID_IMAGE))
                .thenReturn(new ValidatedImage(data, ImageFormat.PNG));
    }

    /** 무작위 UUID 값 대신 생성 이름의 형태와 후속 호출 연결을 검증한다. */
    private void uploaded() {
        when(storage.upload(eq(data), anyString(), eq("image/png"))).thenAnswer(invocation -> {
            uploadedName = invocation.getArgument(1);
            return new UploadedBlob(uploadedName, "https://example.invalid/" + uploadedName);
        });
    }

    /** 사진 파일만 서비스에 전달한다. */
    private void save() { service.savePictureWithCharacter(15L, new SavePictureWithCharacterRequest(file)); }

    /** 스프링·DB 없이 종료 콜백만 호출하며 실제 트랜잭션 검증은 통합 테스트에서 한다. */
    private void complete(int status) {
        TransactionSynchronizationManager.getSynchronizations().forEach(sync -> sync.afterCompletion(status));
    }
}
