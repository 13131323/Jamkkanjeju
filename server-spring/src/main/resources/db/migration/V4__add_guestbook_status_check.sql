-- 방명록 상태는 활성·비활성 두 값으로 제한한다. 기존 데이터는 임의로 변경하지 않는다.
ALTER TABLE `guestbook`
    ADD CONSTRAINT `chk_guestbook_status`
        CHECK (`status` IN ('ACTIVE', 'INACTIVE'));
