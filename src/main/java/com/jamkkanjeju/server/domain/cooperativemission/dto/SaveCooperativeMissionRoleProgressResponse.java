package com.jamkkanjeju.server.domain.cooperativemission.dto;

/** 역할 사진의 인증 성공 여부만 반환한다. */
public record SaveCooperativeMissionRoleProgressResponse(boolean isVerified) {

    /** 사진 판정과 저장 처리 결과로 응답을 구성한다. */
    public static SaveCooperativeMissionRoleProgressResponse of(boolean isVerified) {
        return new SaveCooperativeMissionRoleProgressResponse(isVerified);
    }
}
