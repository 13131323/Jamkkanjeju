package com.jamkkanjeju.server.domain.cooperativemission.service;

import static org.assertj.core.api.Assertions.assertThat;
import static com.jamkkanjeju.server.domain.treasurehunt.support.PictureFixtures.image;
import java.util.List;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/** 임시 판정기는 외부 호출 없이 모든 유효 사진을 성공으로 반환한다. */
class CooperativeMissionPhotoVerifierTest {
    @ParameterizedTest @ValueSource(strings={"JPEG","PNG","WEBP"})
    void 유효사진은_항상_성공한다(String format) {
        assertThat(new CooperativeMissionPhotoVerifier().verify(image(format),
                "image/"+format.toLowerCase(),"역할","설명",List.of("돌담"))).isTrue();
    }
}
