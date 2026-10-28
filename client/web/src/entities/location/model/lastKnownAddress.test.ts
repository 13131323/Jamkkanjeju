import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setJudgeAuthEnabled } from '@shared/api/auth/judgeToken';
import { clearLastKnownAddress, getLastKnownAddress, subscribeLastKnownAddress, writeLastKnownAddress } from './lastKnownAddress';

beforeEach(() => {
  setJudgeAuthEnabled(false);
  clearLastKnownAddress();
});

describe('lastKnownAddress', () => {
  it('저장한 주소를 그대로 돌려준다', () => {
    writeLastKnownAddress('제주시 이도이동');
    expect(getLastKnownAddress()).toBe('제주시 이도이동');
  });

  it('아무것도 저장하지 않았으면 없음이다', () => {
    expect(getLastKnownAddress()).toBeUndefined();
  });

  // 심사위원 모드에서 받은 제주시청 주소가 모드를 꺼도 "현재 위치"처럼 남던 문제
  it('비우면 직전 주소가 사라진다', () => {
    writeLastKnownAddress('제주시 이도이동');
    clearLastKnownAddress();
    expect(getLastKnownAddress()).toBeUndefined();
  });

  it('비울 때 구독자에게 알린다 — 화면이 즉시 자리표시로 돌아가야 한다', () => {
    const listener = vi.fn();
    subscribeLastKnownAddress(listener);
    writeLastKnownAddress('제주시 이도이동');
    listener.mockClear();

    clearLastKnownAddress();

    expect(listener).toHaveBeenCalled();
  });

  it('이미 비어 있으면 굳이 알리지 않는다', () => {
    const listener = vi.fn();
    subscribeLastKnownAddress(listener);

    clearLastKnownAddress();

    expect(listener).not.toHaveBeenCalled();
  });
});

/**
 * 직전 주소는 **계정으로 갈려야 한다.** 한 칸을 함께 쓰면 심사위원용 모드에서 남긴 제주시청 주소가
 * 기본 모드의 첫 화면에 확정값처럼 떴다가 바뀐다 — 쿼리 게이트로는 못 막는다. 값이 네트워크가
 * 아니라 localStorage에서 오기 때문이다.
 */
describe('계정별 분리', () => {
  it('심사위원용 모드에서 남긴 주소는 기본 모드에서 보이지 않는다', () => {
    setJudgeAuthEnabled(true);
    writeLastKnownAddress('제주시 이도이동');

    setJudgeAuthEnabled(false);

    expect(getLastKnownAddress()).toBeUndefined();
  });

  it('기본 모드에서 남긴 주소도 심사위원용 모드로 새지 않는다', () => {
    writeLastKnownAddress('서울시 강남구');

    setJudgeAuthEnabled(true);

    expect(getLastKnownAddress()).toBeUndefined();
  });

  // 모드는 실행 중에 뒤집히고(홈의 "모드변경") 구독은 그때 다시 돌지 않는다 —
  // 읽을 때마다 계정을 확인하지 않으면 메모리 캐시에 직전 계정 값이 남는다
  it('모드를 껐다 켜도 각자의 값을 그대로 본다', () => {
    setJudgeAuthEnabled(true);
    writeLastKnownAddress('제주시 이도이동');
    setJudgeAuthEnabled(false);
    writeLastKnownAddress('서울시 강남구');

    setJudgeAuthEnabled(true);
    expect(getLastKnownAddress()).toBeUndefined();

    setJudgeAuthEnabled(false);
    expect(getLastKnownAddress()).toBeUndefined();
  });
});
