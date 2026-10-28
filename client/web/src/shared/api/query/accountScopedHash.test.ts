import { beforeEach, describe, expect, it } from 'vitest';
import { hashKey } from '@tanstack/react-query';
import { setJudgeAuthEnabled } from '../auth/judgeToken';
import { hashQueryKeyByAccount } from './accountScopedHash';

beforeEach(() => {
  setJudgeAuthEnabled(false);
});

describe('hashQueryKeyByAccount', () => {
  // 같은 키라도 모드가 다르면 다른 캐시 칸에 들어가야 한다 — 그래야 모드를 바꿀 때
  // 캐시를 통째로 버리지 않고도 남의 계정 응답이 화면에 남지 않는다.
  it('모드가 다르면 같은 키라도 다른 해시가 된다', () => {
    const key = ['/api/v1/users/me/home', { latitude: 33.4, longitude: 126.5 }];

    setJudgeAuthEnabled(false);
    const asApp = hashQueryKeyByAccount(key);

    setJudgeAuthEnabled(true);
    const asJudge = hashQueryKeyByAccount(key);

    expect(asApp).not.toBe(asJudge);
  });

  it('같은 모드에서 같은 키면 같은 해시다 — 돌아왔을 때 캐시가 그대로 맞아야 한다', () => {
    const key = ['/api/v1/users/me/home', { latitude: 33.4, longitude: 126.5 }];

    setJudgeAuthEnabled(true);
    const first = hashQueryKeyByAccount(key);
    setJudgeAuthEnabled(false);
    setJudgeAuthEnabled(true);
    const second = hashQueryKeyByAccount(key);

    expect(first).toBe(second);
  });

  // 기본 해시(hashKey)는 객체 키 순서를 정렬해 안정적으로 만든다. 직접 JSON.stringify로
  // 바꾸면 orval이 만든 params 객체의 키 순서가 달라질 때 같은 조회가 두 벌로 갈린다.
  it('객체 키 순서가 달라도 같은 해시다', () => {
    const a = hashQueryKeyByAccount(['x', { latitude: 1, longitude: 2 }]);
    const b = hashQueryKeyByAccount(['x', { longitude: 2, latitude: 1 }]);

    expect(a).toBe(b);
  });

  it('키가 다르면 다른 해시다', () => {
    expect(hashQueryKeyByAccount(['a'])).not.toBe(hashQueryKeyByAccount(['b']));
  });

  it('모드 접두사를 뺀 나머지는 기본 해시 규칙을 그대로 따른다', () => {
    expect(hashQueryKeyByAccount(['a', 1])).toBe(hashKey(['app', 'a', 1]));
  });
});
