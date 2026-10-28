import { describe, expect, it } from 'vitest';
import {
  CAMERA_GUIDE_DEFAULT,
  CAMERA_GUIDE_LOOK_AROUND,
  CAMERA_GUIDE_MAX_LENGTH,
  CAMERA_GUIDE_NO_COORDS,
  CAMERA_GUIDE_NO_HEADING,
  resolveCameraGuide,
} from './cameraGuide';

const ALL_MESSAGES = [CAMERA_GUIDE_DEFAULT, CAMERA_GUIDE_NO_COORDS, CAMERA_GUIDE_NO_HEADING, CAMERA_GUIDE_LOOK_AROUND];

describe('resolveCameraGuide', () => {
  it('보물이 보이면 디자인 기본 문구', () => {
    expect(resolveCameraGuide({ hasCoords: true, hasValidHeading: true, visibleTreasureCount: 1 })).toBe(CAMERA_GUIDE_DEFAULT);
  });

  it('반경 안이지만 향한 방향에 보물이 없으면 둘러보라고 안내한다 — 고장이 아니다', () => {
    expect(resolveCameraGuide({ hasCoords: true, hasValidHeading: true, visibleTreasureCount: 0 })).toBe(CAMERA_GUIDE_LOOK_AROUND);
  });

  it('나침반이 없으면 그것을 말한다 — 에뮬레이터에서 빈 화면의 원인이 이것이다', () => {
    expect(resolveCameraGuide({ hasCoords: true, hasValidHeading: false, visibleTreasureCount: 0 })).toBe(CAMERA_GUIDE_NO_HEADING);
  });

  it('좌표가 없으면 나침반보다 먼저 알린다 — 좌표 없이는 방위각을 계산할 대상이 없다', () => {
    expect(resolveCameraGuide({ hasCoords: false, hasValidHeading: false, visibleTreasureCount: 0 })).toBe(CAMERA_GUIDE_NO_COORDS);
    // 나침반이 멀쩡해도 좌표가 우선이다
    expect(resolveCameraGuide({ hasCoords: false, hasValidHeading: true, visibleTreasureCount: 0 })).toBe(CAMERA_GUIDE_NO_COORDS);
  });

  it('결핍이 있으면 보물 수와 무관하게 결핍을 먼저 알린다', () => {
    // 이전 프레임의 배치가 남아 있어 개수가 0이 아닐 수 있다 — 그래도 상태 안내가 우선이다
    expect(resolveCameraGuide({ hasCoords: false, hasValidHeading: true, visibleTreasureCount: 3 })).toBe(CAMERA_GUIDE_NO_COORDS);
    expect(resolveCameraGuide({ hasCoords: true, hasValidHeading: false, visibleTreasureCount: 3 })).toBe(CAMERA_GUIDE_NO_HEADING);
  });

  it('네 문구는 서로 달라야 한다 — 같으면 상태를 구분해 주는 의미가 없다', () => {
    expect(new Set(ALL_MESSAGES).size).toBe(ALL_MESSAGES.length);
  });
});

/**
 * 안내 알약은 한 줄짜리 높이를 전제로 놓여 있다(카메라 화면을 덜 가리려고).
 * 문구가 두 줄로 흐르면 알약이 부풀어 그 전제가 깨진다 — 길이를 코드로 묶어 둔다.
 */
describe('안내 문구 길이 — 한 줄 유지', () => {
  it('줄바꿈을 강제하지 않는다', () => {
    for (const message of ALL_MESSAGES) {
      expect(message).not.toContain('\n');
    }
  });

  it('가용 폭(360dp 화면에서 262dp) 안에 들어간다', () => {
    // 모든 글자가 한글이라고 가정한 최악 기준이다. 공백·마침표는 더 좁으므로 실제로는 여유가 남는다.
    for (const message of ALL_MESSAGES) {
      expect(message.length).toBeLessThanOrEqual(CAMERA_GUIDE_MAX_LENGTH);
    }
  });

  it('가장 긴 문구도 한 줄이다 — 여기가 깨지면 나머지는 볼 필요도 없다', () => {
    const longest = ALL_MESSAGES.reduce((a, b) => (a.length >= b.length ? a : b));

    expect(longest.length).toBeLessThanOrEqual(CAMERA_GUIDE_MAX_LENGTH);
  });
});
