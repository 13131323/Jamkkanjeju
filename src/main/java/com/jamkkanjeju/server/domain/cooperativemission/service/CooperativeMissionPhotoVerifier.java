package com.jamkkanjeju.server.domain.cooperativemission.service;

import java.util.List;
import org.springframework.stereotype.Component;

/** 검증된 사진이 역할 카드의 조건에 적합한지 판단하는 컴포넌트이다. 현재는 임시 성공 판정만 수행한다. */
@Component
public class CooperativeMissionPhotoVerifier {

    /** 이미지 원본·실제 MIME type과 역할 정보를 받아 인증 성공 여부만 반환한다. */
    public boolean verify(byte[] imageBytes, String contentType, String roleName,
                          String roleDescription, List<String> locationToFind) {
        // TODO: 추후 역할 카드 정보와 사진 내용을 기반으로 실제 사진 인증 판정 로직을 구현한다. 현재는 항상 인증 성공을 반환한다.
        return true;
    }
}
