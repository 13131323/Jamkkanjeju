package com.jamkkanjeju.server.domain.agent.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;

import com.jamkkanjeju.server.domain.agent.dto.GetAgentGuestbooksRequest;
import com.jamkkanjeju.server.domain.agent.dto.GetAgentGuestbooksResponse.GuestbookText;
import com.jamkkanjeju.server.domain.guestbook.entity.GuestbookStatus;
import com.jamkkanjeju.server.domain.guestbook.repository.LocationGuestbookRepository;
import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.SliceImpl;

/** DB 없이 전체 조회와 선택한 ID 조회의 분기를 검증한다. */
@ExtendWith(MockitoExtension.class)
class AgentGuestbookServiceTest {
    @Mock LocationGuestbookRepository repository;

    @Test
    void ID를_생략하면_기존_전체_조회한다() {
        var page = PageRequest.of(0, 100);
        given(repository.findTextsByStatus(GuestbookStatus.ACTIVE, page))
                .willReturn(new SliceImpl<>(List.of(new GuestbookText(3L, 10L, "원문")), page, false));
        var response = new AgentGuestbookService(repository).getGuestbooks(new GetAgentGuestbooksRequest(null, null));
        assertThat(response.guestbooks()).containsExactly(new GuestbookText(3L, 10L, "원문"));
        verify(repository).findTextsByStatus(GuestbookStatus.ACTIVE, page);
        verifyNoMoreInteractions(repository);
    }

    @Test
    void 선택한_ID와_ACTIVE_조건으로_조회하며_null_원문도_유지한다() {
        var page = PageRequest.of(0, 100);
        var ids = List.of(10L, 11L, 12L);
        given(repository.findTextsByStatusAndIds(GuestbookStatus.ACTIVE, ids, page))
                .willReturn(new SliceImpl<>(Arrays.asList(new GuestbookText(3L, 10L, null),
                        new GuestbookText(3L, 12L, "원문")), page, false));
        var response = new AgentGuestbookService(repository).getGuestbooks(new GetAgentGuestbooksRequest(0, 100, ids));
        assertThat(response.guestbooks()).hasSize(2);
        assertThat(response.guestbooks().getFirst().text()).isNull();
        assertThat(response.guestbooksPage().hasNext()).isFalse();
        verify(repository).findTextsByStatusAndIds(GuestbookStatus.ACTIVE, ids, page);
        verifyNoMoreInteractions(repository);
    }

    @Test
    void 조회_대상이_없으면_빈_목록이다() {
        var page = PageRequest.of(0, 100);
        given(repository.findTextsByStatusAndIds(GuestbookStatus.ACTIVE, List.of(999L), page))
                .willReturn(new SliceImpl<>(List.of(), page, false));
        var response = new AgentGuestbookService(repository).getGuestbooks(new GetAgentGuestbooksRequest(0, 100, List.of(999L)));
        assertThat(response.guestbooks()).isEmpty();
    }
}
