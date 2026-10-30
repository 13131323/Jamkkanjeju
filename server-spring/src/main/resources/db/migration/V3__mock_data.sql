-- 제주시청 심사위원 좌표(33.4996, 126.5312) 주변의 지도·미션 테스트 데이터.
-- 현재 로컬 DB에 수집된 실제 TourAPI 장소 중 20개를 선택했다. 기존 가짜 content_id 990001~990008은 포함하지 않는다.
-- 장소 간격은 최소 약 500m, 심사위원 좌표로부터 약 300m~2.9km이며 원본 content_id·장소명·주소·분류·좌표를 유지한다.
-- 사용자·문화 미션 진행도·방문 기록·방명록과 라토커피제주 보물찾기·블루메베이글 협동 미션을 포함한다.

-- ---------------------------------------------------------------------
-- 사용자
-- ---------------------------------------------------------------------

-- 1번 사용자에게 온보딩 결과(제주 사진작가)를 배정해 홈의 characterImgUrl을 확인할 수 있게 한다.
UPDATE `user`
SET `onboarding_result_id` = (SELECT `id` FROM `onboarding_result` WHERE `user_type` = '제주 사진작가' ORDER BY `id` LIMIT 1)
WHERE `id` = 1;

-- 방명록 작성자로 쓰는 사용자. 비밀번호는 1번 사용자와 같다.
INSERT INTO `user`
    (`id`, `onboarding_result_id`, `nickname`, `email`, `password_hash`, `role`, `status`, `guestbook_last_checked_at`)
VALUES
    (2, 2, '함께 걷는 친구', '22345678@gmail.com',
     '$2a$10$LpoZ46Wmj9cManptR.Vm4ORf63v6jMhsOku..H8TkD3swRmBKwacK', 'USER', 'ACTIVE', CURRENT_TIMESTAMP(6)),
    (3, 3, '바다 보는 여행자', '32345678@gmail.com',
     '$2a$10$LpoZ46Wmj9cManptR.Vm4ORf63v6jMhsOku..H8TkD3swRmBKwacK', 'USER', 'ACTIVE', CURRENT_TIMESTAMP(6));

-- ---------------------------------------------------------------------
-- 장소
-- ---------------------------------------------------------------------

INSERT INTO `location`
    (`id`, `content_id`, `title`, `address`, `category`, `radius`, `latitude`, `longitude`)
VALUES
    (1, 2853982, '라토커피제주', '제주특별자치도 제주시 광양10길 20 (이도이동)', '음식', 100, 33.4987305369, 126.5281672061),
    (2, 2899568, '블루메베이글', '제주특별자치도 제주시 가령로4길 3', '음식', 100, 33.496741947, 126.5331112664),
    (3, 2860705, '남춘식당', '제주특별자치도 제주시 청귤로 12 (이도이동)', '음식', 100, 33.4996944686, 126.5375247049),
    (4, 2824043, '행복밀', '제주특별자치도 제주시 서광로 239 (삼도일동)', '음식', 100, 33.5000525164, 126.5220815945),
    (5, 2839938, '한라향', '제주특별자치도 제주시 도남로 104 (도남동, 백록아파트)', '음식', 100, 33.4911897022, 126.5279562849),
    (6, 2854384, '형돈', '제주특별자치도 제주시 구남로 22 (이도이동)', '음식', 100, 33.4893510958, 126.5329253392),
    (7, 1883646, '만세국수', '제주특별자치도 제주시 오라로 152 (오라일동)', '음식', 100, 33.494136452, 126.5187959033),
    (8, 1404293, '바그다드', '제주특별자치도 제주시 관덕로8길 34', '음식', 100, 33.5103069552, 126.523242372),
    (9, 1906211, '두맹이골목', '제주특별자치도 제주시 동문로16길 17-4 (일도이동)', '문화관광', 100, 33.5120458378, 126.5349218725),
    (10, 2899545, '아베베베이커리', '제주특별자치도 제주시 동문로6길 4 동문시장 12번 게이트 옆', '음식', 100, 33.5126845582, 126.5288029453),
    (11, 2861967, '장모식탁', '제주특별자치도 제주시 연신로 51 (이도이동)', '음식', 100, 33.4968782641, 126.5469489499),
    (12, 2871934, '배셰프', '제주특별자치도 제주시 구산로 3 (아라일동)', '음식', 100, 33.4843433703, 126.5362973823),
    (13, 2870843, '제주시새우리', '제주특별자치도 제주시 무근성7길 24 (삼도이동)', '음식', 100, 33.5146397691, 126.5207480456),
    (14, 131106, '제주항 서부두방파제', '제주특별자치도 제주시 서부두길 22', '레저스포츠', 100, 33.5181617247, 126.5284806266),
    (15, 2876854, '제주또시랑', '제주특별자치도 제주시 연북로 724 1층', '음식', 100, 33.4956423901, 126.5532484301),
    (16, 2839794, '임성반점', '제주특별자치도 제주시 용화로 57-1 (용담이동)', '음식', 100, 33.5095179388, 126.509763006),
    (17, 126454, '사라봉공원', '제주특별자치도 제주시 사라봉길 75 (건입동)', '문화관광', 100, 33.5160372422, 126.5462013564),
    (18, 2949573, '제주문학관', '제주특별자치도 제주시 연북로 339 (도남동)', '문화관광', 100, 33.4813850713, 126.5178573851),
    (19, 129148, '산지 등대', '제주특별자치도 제주시 사라봉동길 108-1 (건입동)', '문화관광', 100, 33.5209144715, 126.5456624039),
    (20, 2854335, '피커스 제주', '제주특별자치도 제주시 아연로 444-1 (오등동)', '음식', 100, 33.4739110719, 126.5287816055);

-- ---------------------------------------------------------------------
-- 장소 쿠폰과 1번 사용자의 획득 쿠폰
-- ---------------------------------------------------------------------

INSERT INTO `coupon` (`id`, `location_id`, `coupon_price`)
VALUES
    (1, 1, 1000),
    (2, 2, 2000),
    (3, 3, 3000),
    (4, 2, 2000), -- 협동 미션 보상: 블루메베이글 2,000원
    (5, 1, 1000); -- 보물찾기 보상: 라토커피제주 1,000원

INSERT INTO `acquired_coupon` (`coupon_id`, `user_id`, `acquired_at`)
VALUES
    (1, 1, CURRENT_TIMESTAMP),
    (2, 1, CURRENT_TIMESTAMP);

-- ---------------------------------------------------------------------
-- 라토커피제주(장소 1번)의 보물찾기·블루메베이글(장소 2번)의 협동 미션
-- ---------------------------------------------------------------------

INSERT INTO `mission` (`mission_type_id`)
SELECT `id` FROM `mission_type` WHERE `type` = 'COOPERATIVE';

INSERT INTO `cooperative_mission` (`mission_id`, `location_id`, `status`, `ar_character_id`, `point`, `coupon_id`)
VALUES (LAST_INSERT_ID(), 2, 'ACTIVE', 5, 200, 4);

INSERT INTO `mission` (`mission_type_id`)
SELECT `id` FROM `mission_type` WHERE `type` = 'TREASURE';

INSERT INTO `treasure_mission` (`mission_id`, `location_id`, `item_total_count`, `status`, `ar_character_id`, `point`, `coupon_id`)
VALUES (LAST_INSERT_ID(), 1, 3, 'ACTIVE', 6, 100, 5);

INSERT INTO `visited_location`
    (`id`, `user_id`, `location_id`, `last_visited_at`)
VALUES
    (1, 1, 1, '2026-10-01 11:00:00'),
    (2, 2, 7, '2026-10-02 15:30:00'),
    (3, 3, 4, '2026-10-03 07:10:00');

-- ---------------------------------------------------------------------
-- 문화 미션 진행
-- ---------------------------------------------------------------------

-- 1번 사용자: 문화 1~10번을 각각 3문제 중 1개만 맞히고 완료한 기록.
INSERT INTO `culture_mission_progress`
    (`id`, `culture_mission_id`, `user_id`, `mission_status`, `current_quiz_index`, `correct_count`, `last_completed_at`)
SELECT cm.`mission_id`, cm.`mission_id`, 1, 'COMPLETED', MAX(q.`quiz_index`), 1, CURRENT_TIMESTAMP
FROM `culture_mission` cm
JOIN `culture_mission_quiz` q ON q.`culture_mission_id` = cm.`mission_id`
WHERE cm.`mission_id` BETWEEN 1 AND 10
GROUP BY cm.`mission_id`;

-- 현재 보상 지급 방식과 동일하게 미션별 캐릭터 획득 기록을 남긴다.
INSERT INTO `acquired_ar_character` (`ar_character_id`, `user_id`, `mission_id`)
SELECT `ar_character_id`, 1, `mission_id`
FROM `culture_mission`
WHERE `mission_id` BETWEEN 1 AND 10 AND `ar_character_id` IS NOT NULL;

-- 정답 1개에 해당하는 첫 번째 보상(AR 캐릭터)만 지급한 상태다.
INSERT INTO `mission_reward_status`
    (`mission_id`, `user_id`, `ar_character_reward_granted`, `point_reward_granted`, `coupon_reward_granted`)
SELECT `mission_id`, 1, TRUE, FALSE, FALSE
FROM `culture_mission`
WHERE `mission_id` BETWEEN 1 AND 10;

-- ---------------------------------------------------------------------
-- 방명록 (장소 방명록 3건, 길바닥 방명록 2건)
-- ---------------------------------------------------------------------

INSERT INTO `guestbook`
    (`id`, `user_id`, `visited_at`, `content_img_url`, `content_writing`, `content_audio_url`, `audio_title`,
     `content_weather`, `content_temperature_celsius`, `content_color_code`, `saved_at`, `status`)
VALUES
    (1, 1, '2026-10-01', 'https://jamkkanjejustorage.blob.core.windows.net/jamkkanjeju/guestbooke_test/test_image.png', '라토커피제주 근처에서 보물을 다 찾았다!', NULL, NULL, '맑음', 22.5, '#4FC3F7',
     '2026-10-01 12:00:00', 'ACTIVE'),
    (2, 1, '2026-10-04', 'https://jamkkanjejustorage.blob.core.windows.net/jamkkanjeju/guestbooke_test/test_image.png', '돌담길 따라 걷다가 쉬어 간 곳', NULL, NULL, '흐림', 19.0, '#A5D6A7',
     '2026-10-04 17:30:00', 'ACTIVE'),
    (3, 2, '2026-10-02', 'https://jamkkanjejustorage.blob.core.windows.net/jamkkanjeju/guestbooke_test/test_image.png', '만세국수에서 든든하게 먹고 쉬어 갔다', NULL, NULL, '맑음', 23.0, '#FFB74D',
     '2026-10-02 16:00:00', 'ACTIVE'),
    (4, 3, '2026-10-03', 'https://jamkkanjejustorage.blob.core.windows.net/jamkkanjeju/guestbooke_test/test_image.png', '행복밀 근처를 산책했다', NULL, NULL, '맑음', 15.5, '#FF8A65',
     '2026-10-03 07:30:00', 'ACTIVE'),
    (5, 3, '2026-10-03', 'https://jamkkanjejustorage.blob.core.windows.net/jamkkanjeju/guestbooke_test/test_image.png', '바람 많이 부는 해안도로', NULL, NULL, '바람', 17.0, '#90A4AE',
     '2026-10-03 10:10:00', 'ACTIVE');

INSERT INTO `location_guestbook` (`guestbook_id`, `visited_location_id`, `mission_id`)
VALUES
    (1, 1, NULL),
    (3, 2, NULL),
    (4, 3, NULL);

INSERT INTO `road_guestbook` (`guestbook_id`, `location_alias`, `latitude`, `longitude`)
VALUES
    (2, '제주시청 앞 골목', 33.5000, 126.5308),
    (5, '제주시청 남동쪽 산책길', 33.4988, 126.5320);
