package com.jamkkanjeju.server.domain.cooperativemission.dto;

import static org.assertj.core.api.Assertions.*;
import jakarta.validation.Validation;
import org.junit.jupiter.api.Test;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;

/** 참가자 ID 필수 여부와 Long 정수 외 JSON 형식의 거부를 검증한다. */
class SaveCooperativeMissionRoleAssignmentRequestTest {
    @Test void 참가자ID는_필수이며_문서에없는_양수제한은_추가하지않는다() {
        try(var factory=Validation.buildDefaultValidatorFactory()) {
            var validator=factory.getValidator();
            assertThat(validator.validate(new SaveCooperativeMissionRoleAssignmentRequest(null))).hasSize(1);
            for(long id:new long[]{Long.MIN_VALUE,-1,0,1,Long.MAX_VALUE}) {
                assertThat(validator.validate(new SaveCooperativeMissionRoleAssignmentRequest(id))).isEmpty();
            }
        }
    }
    @Test void Long정수만_그대로읽고_다른형식은_자동변환하지않는다() {
        var mapper=JsonMapper.builder().build();
        for(long id:new long[]{Long.MIN_VALUE,0,21,Long.MAX_VALUE}) {
            assertThat(mapper.readValue("{\"participantId\":"+id+"}",SaveCooperativeMissionRoleAssignmentRequest.class).participantId()).isEqualTo(id);
        }
        assertThat(mapper.readValue("{}",SaveCooperativeMissionRoleAssignmentRequest.class).participantId()).isNull();
        for(String value:new String[]{"2.5","\"21\"","true","[]","{}","9223372036854775808"}) {
            assertThatThrownBy(() -> mapper.readValue("{\"participantId\":"+value+"}",SaveCooperativeMissionRoleAssignmentRequest.class))
                    .isInstanceOf(JacksonException.class);
        }
    }
}
