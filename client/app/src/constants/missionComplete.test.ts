import { describe, expect, it } from 'vitest';
import { formatDistanceBadge, toCompleteResultRows, toMissionCompleteContent, toNextPlaceDescription } from './missionComplete';
import type { MissionCompleteFallback } from './missionComplete';

const fullReward = {
  arCharacter: { id: 1, name: '돌담이', imageUrl: 'https://example.com/dolmeong.png' },
  point: 100,
  coupon: { couponLocation: '종화네 막국수', couponPrice: 1000 },
};

const nextLocation = {
  id: 9,
  locationTitle: '한담 해안 산책로',
  locationImageUrl: 'https://example.com/handam.jpg',
  mission: { id: 3, missionType: 'TREASURE' as const },
  distanceMeter: 500,
};

const FALLBACK: MissionCompleteFallback = {
  resultRows: [
    { label: '포인트', badge: '+100P' },
    { label: '로컬 쿠폰', badge: '천원 쿠폰' },
    { label: 'AR 캐릭터 도감', badge: '돌담이' },
  ],
  placeDescription: '한담 해안 산책로에서 보물찾기 미션에 참여해보세요!',
  distanceBadgeText: '500m',
};

describe('toCompleteResultRows', () => {
  it('지급된 세 보상을 포인트·쿠폰·AR 캐릭터 순으로 만든다', () => {
    expect(toCompleteResultRows(fullReward)).toEqual([
      { label: '포인트', badge: '+100P' },
      { label: '로컬 쿠폰', badge: '1,000원 쿠폰' },
      { label: 'AR 캐릭터 도감', badge: '돌담이' },
    ]);
  });

  it('지급되지 않은(null) 항목은 행을 만들지 않는다', () => {
    expect(toCompleteResultRows({ ...fullReward, coupon: null })).toEqual([
      { label: '포인트', badge: '+100P' },
      { label: 'AR 캐릭터 도감', badge: '돌담이' },
    ]);
    expect(toCompleteResultRows({ ...fullReward, point: null })).toEqual([
      { label: '로컬 쿠폰', badge: '1,000원 쿠폰' },
      { label: 'AR 캐릭터 도감', badge: '돌담이' },
    ]);
    expect(toCompleteResultRows({ ...fullReward, arCharacter: null })).toEqual([
      { label: '포인트', badge: '+100P' },
      { label: '로컬 쿠폰', badge: '1,000원 쿠폰' },
    ]);
  });

  it('포인트 0은 미지급(null)과 달리 그대로 보여준다', () => {
    expect(toCompleteResultRows({ point: 0 })).toEqual([{ label: '포인트', badge: '+0P' }]);
  });

  it('쿠폰 금액에 천 단위 구분을 넣는다 — 인트로 보상 배지와 같은 문구가 나와야 한다', () => {
    const rows = toCompleteResultRows({ coupon: { couponLocation: '카페', couponPrice: 10000 } });

    expect(rows[0].badge).toBe('10,000원 쿠폰');
  });

  it('지급된 게 없으면 빈 배열이다 — 아무것도 못 받고 중단한 미션', () => {
    expect(toCompleteResultRows({ arCharacter: null, point: null, coupon: null })).toEqual([]);
    expect(toCompleteResultRows({})).toEqual([]);
  });
});

describe('formatDistanceBadge', () => {
  it('1km 미만은 미터로 반올림한다', () => {
    expect(formatDistanceBadge(0)).toBe('0m');
    expect(formatDistanceBadge(499)).toBe('499m');
    expect(formatDistanceBadge(500)).toBe('500m');
    expect(formatDistanceBadge(999)).toBe('999m');
  });

  it('1km 이상은 소수 첫째 자리까지 km로 줄이고 뒷자리 0은 뗀다', () => {
    expect(formatDistanceBadge(1000)).toBe('1km');
    expect(formatDistanceBadge(1240)).toBe('1.2km');
    expect(formatDistanceBadge(1250)).toBe('1.3km');
    expect(formatDistanceBadge(12345)).toBe('12.3km');
  });

  it('유효하지 않은 값은 0m로 막는다 — "NaNm"가 그려지면 안 된다', () => {
    expect(formatDistanceBadge(-1)).toBe('0m');
    expect(formatDistanceBadge(Number.NaN)).toBe('0m');
    expect(formatDistanceBadge(Number.POSITIVE_INFINITY)).toBe('0m');
  });
});

describe('toNextPlaceDescription', () => {
  it('미션 유형별 문구를 붙인다', () => {
    expect(toNextPlaceDescription({ ...nextLocation, mission: { id: 1, missionType: 'CULTURE' } })).toBe('한담 해안 산책로에서 문화 미션에 참여해보세요!');
    expect(toNextPlaceDescription({ ...nextLocation, mission: { id: 2, missionType: 'COOPERATIVE' } })).toBe('한담 해안 산책로에서 협동 미션에 참여해보세요!');
    expect(toNextPlaceDescription({ ...nextLocation, mission: { id: 3, missionType: 'TREASURE' } })).toBe('한담 해안 산책로에서 보물찾기 미션에 참여해보세요!');
  });

  it('미션이 없는 장소는 방문만 권한다', () => {
    expect(toNextPlaceDescription({ ...nextLocation, mission: null })).toBe('한담 해안 산책로에 방문해보세요!');
  });
});

describe('toMissionCompleteContent', () => {
  it('응답이 없으면 디자인 폴백을 쓰고, 응답에만 있는 값은 null로 둔다 — 완료 API가 없는 보물찾기·협동', () => {
    expect(toMissionCompleteContent(null, FALLBACK)).toEqual({ ...FALLBACK, celebrationUri: null, placeId: null, placePhotoUrl: null });
  });

  it('완전한 응답은 모든 필드를 덮는다', () => {
    expect(toMissionCompleteContent({ reward: fullReward, nextLocation: { ...nextLocation, distanceMeter: 1240 } }, FALLBACK)).toEqual({
      resultRows: [
        { label: '포인트', badge: '+100P' },
        { label: '로컬 쿠폰', badge: '1,000원 쿠폰' },
        { label: 'AR 캐릭터 도감', badge: '돌담이' },
      ],
      celebrationUri: 'https://example.com/dolmeong.png',
      placePhotoUrl: 'https://example.com/handam.jpg',
      placeDescription: '한담 해안 산책로에서 보물찾기 미션에 참여해보세요!',
      distanceBadgeText: '1.2km',
      placeId: 9,
    });
  });

  it('축하 이미지는 지급된 AR 캐릭터 그림을 쓴다. 캐릭터를 못 받았으면 null이라 번들 에셋으로 그린다', () => {
    const withCharacter = toMissionCompleteContent({ reward: fullReward, nextLocation: null }, FALLBACK);
    const withoutCharacter = toMissionCompleteContent({ reward: { ...fullReward, arCharacter: null }, nextLocation: null }, FALLBACK);

    expect(withCharacter.celebrationUri).toBe('https://example.com/dolmeong.png');
    expect(withoutCharacter.celebrationUri).toBeNull();
  });

  it('다음 장소가 없으면 placeId가 null이다 — 열 상세 화면이 없어 카드를 누를 수 없어야 한다', () => {
    expect(toMissionCompleteContent({ reward: null, nextLocation: null }, FALLBACK).placeId).toBeNull();
  });

  it('보상 객체가 왔는데 지급된 게 없으면 빈 행으로 둔다 — 폴백을 쓰면 받지 않은 보상을 보여준다', () => {
    const content = toMissionCompleteContent({ reward: { arCharacter: null, point: null, coupon: null }, nextLocation: null }, FALLBACK);

    expect(content.resultRows).toEqual([]);
  });

  it('장소 사진이 없으면 사진 URL을 null로 두고 문구·거리는 서버 값을 쓴다 — 레이아웃이 그 자리를 스켈레톤으로 그린다', () => {
    const content = toMissionCompleteContent({ reward: null, nextLocation: { ...nextLocation, locationImageUrl: null, distanceMeter: 820, mission: null } }, FALLBACK);

    expect(content.placePhotoUrl).toBeNull();
    // 빈 문자열도 "없음"이다 — {uri: ''}로 Image를 그리면 로드 실패를 거친 뒤에야 자리가 비워진다
    expect(toMissionCompleteContent({ reward: null, nextLocation: { ...nextLocation, locationImageUrl: '' } }, FALLBACK).placePhotoUrl).toBeNull();
    expect(content.placeDescription).toBe('한담 해안 산책로에 방문해보세요!');
    expect(content.distanceBadgeText).toBe('820m');
    // reward가 null이면(진행 중 응답) 아직 모르는 상태이므로 폴백 행을 그대로 쓴다
    expect(content.resultRows).toBe(FALLBACK.resultRows);
  });
});
