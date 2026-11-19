package com.jamkkanjeju.server.domain.agent.dto;

import static org.assertj.core.api.Assertions.assertThat;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jamkkanjeju.server.domain.agent.controller.AgentGuestbookController;
import com.jamkkanjeju.server.domain.agent.service.AgentGuestbookService;
import org.mockito.ArgumentCaptor;
import jakarta.validation.Validation;
import java.util.Arrays;
import java.util.List;
import java.util.stream.LongStream;
import org.junit.jupiter.api.Test;

/** 선택 원문 조회의 ID 목록 크기와 양수 제약을 검증한다. */
class GetAgentGuestbooksRequestTest {
    @Test
    void HTTP_Query에서_ID_배열을_바인딩하고_양수_검증한다() throws Exception {
        var service = mock(AgentGuestbookService.class);
        when(service.getGuestbooks(any()))
                .thenReturn(new GetAgentGuestbooksResponse(List.of(), new GetAgentGuestbooksResponse.GuestbooksPage(0, 100, false)));
        var mvc = standaloneSetup(
                new AgentGuestbookController(service)).build();
        mvc.perform(get("/api/v2/agent/guestbooks")
                .param("guestbookIds", "1,2"))
                .andExpect(status().isOk());
        var captor = ArgumentCaptor.forClass(GetAgentGuestbooksRequest.class);
        verify(service).getGuestbooks(captor.capture());
        assertThat(captor.getValue().guestbookIds()).containsExactly(1L, 2L);
        assertThat(captor.getValue().size()).isEqualTo(100);
        mvc.perform(get("/api/v2/agent/guestbooks")
                .param("guestbookIds", "0"))
                .andExpect(status().isBadRequest());
        verifyNoMoreInteractions(service);
    }

    @Test
    void 생략_단일_다중_최대100개_요청은_유효하다() {
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            var validator = factory.getValidator();
            for (var request : List.of(new GetAgentGuestbooksRequest(null, null),
                    new GetAgentGuestbooksRequest(0, 100, List.of(1L)),
                    new GetAgentGuestbooksRequest(0, 100, List.of(1L, 2L)),
                    new GetAgentGuestbooksRequest(0, 100, LongStream.rangeClosed(1, 100).boxed().toList()))) {
                assertThat(validator.validate(request)).isEmpty();
                assertThat(request.page()).isZero();
                assertThat(request.size()).isEqualTo(100);
            }
        }
    }

    @Test
    void 빈목록_0_음수_101개는_거부한다() {
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            var validator = factory.getValidator();
            for (List<Long> ids : List.of(List.<Long>of(), List.of(0L), List.of(-1L),
                    LongStream.rangeClosed(1, 101).boxed().toList(), Arrays.asList(1L, null))) {
                assertThat(validator.validate(new GetAgentGuestbooksRequest(0, 100, ids))).isNotEmpty();
            }
        }
    }
}
