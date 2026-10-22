package com.jamkkanjeju.server.domain.cooperativemission.dto;

import static org.assertj.core.api.Assertions.assertThat;
import jakarta.validation.Validation;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import tools.jackson.databind.json.JsonMapper;

/** 사진 필수값과 판정 결과의 공개 JSON 계약을 검증한다. */
class SaveCooperativeMissionRoleProgressDtoTest {
    @Test void 파일은_필수이며_전달한파일을_유지한다() {
        try (var factory=Validation.buildDefaultValidatorFactory()) {
            var validator=factory.getValidator();
            assertThat(validator.validate(new SaveCooperativeMissionRoleProgressRequest(null))).hasSize(1);
            var file=new MockMultipartFile("itemImage",new byte[]{1});
            var request=new SaveCooperativeMissionRoleProgressRequest(file);
            assertThat(validator.validate(request)).isEmpty();
            assertThat(request.itemImage()).isSameAs(file);
        }
    }
    @Test void 성공실패_모두_isVerified만_노출한다() throws Exception {
        var mapper=JsonMapper.builder().build();
        for(boolean verified:new boolean[]{true,false})
            assertThat(mapper.writeValueAsString(SaveCooperativeMissionRoleProgressResponse.of(verified)))
                    .isEqualTo("{\"isVerified\":"+verified+"}");
    }
}
