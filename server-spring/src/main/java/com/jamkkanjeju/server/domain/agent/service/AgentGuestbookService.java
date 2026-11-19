package com.jamkkanjeju.server.domain.agent.service;

import com.jamkkanjeju.server.domain.agent.dto.GetAgentGuestbooksRequest;
import com.jamkkanjeju.server.domain.agent.dto.GetAgentGuestbooksResponse;
import com.jamkkanjeju.server.domain.guestbook.entity.GuestbookStatus;
import com.jamkkanjeju.server.domain.guestbook.repository.LocationGuestbookRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 장소에 연결된 활성 방명록을 분석용으로 읽는다. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AgentGuestbookService {
    private final LocationGuestbookRepository repository;
    /** 원문을 변경하지 않고 ID 순으로 한 페이지를 조회한다. */
    public GetAgentGuestbooksResponse getGuestbooks(GetAgentGuestbooksRequest request) {
        if (request.guestbookIds() != null) {
            return GetAgentGuestbooksResponse.from(repository.findTextsByStatusAndIds(
                    GuestbookStatus.ACTIVE, request.guestbookIds(), PageRequest.of(request.page(), request.size())));
        }
        return GetAgentGuestbooksResponse.from(repository.findTextsByStatus(
                GuestbookStatus.ACTIVE, PageRequest.of(request.page(), request.size())));
    }
}
