import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  readAppSetting: vi.fn(),
  writeAppSetting: vi.fn(),
}));

// 실물은 sqlite → expo-sqlite → react-native/index.js(Flow)까지 끌고 와 vitest가 파싱에 실패한다.
// 저장소를 갈아 끼우고 "무엇을 쓰고 무엇으로 접는지"만 본다(auth.test.ts와 같은 이유).
vi.mock('@/db/appSetting', () => ({
  readAppSetting: mocks.readAppSetting,
  writeAppSetting: mocks.writeAppSetting,
}));

describe('parseStoredJudgeMode', () => {
  // web의 parseStoredJudgeMode와 같은 규칙이어야 한다 — 두 저장소가 같은 문자열을 같은 뜻으로 읽는다
  it.each([
    ['true', true],
    ['false', false],
    [null, false],
    ['', false],
    ['TRUE', false],
    ['1', false],
  ])('저장값 %s는 %s로 접힌다', async (raw, expected) => {
    const { parseStoredJudgeMode } = await import('./judgeModePersistence');
    expect(parseStoredJudgeMode(raw)).toBe(expected);
  });
});

describe('restoreJudgeMode', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { useJudgeModeStore } = await import('@/store/judgeMode');
    useJudgeModeStore.getState().setEnabled(false);
  });

  it('저장값이 켜짐이면 스토어를 켠다', async () => {
    mocks.readAppSetting.mockResolvedValue('true');
    const { restoreJudgeMode } = await import('./judgeModePersistence');
    const { useJudgeModeStore } = await import('@/store/judgeMode');

    await expect(restoreJudgeMode()).resolves.toBe(true);
    expect(useJudgeModeStore.getState().enabled).toBe(true);
  });

  it('저장값이 없으면 꺼진 채로 확정한다', async () => {
    mocks.readAppSetting.mockResolvedValue(null);
    const { restoreJudgeMode } = await import('./judgeModePersistence');
    const { useJudgeModeStore } = await import('@/store/judgeMode');

    await expect(restoreJudgeMode()).resolves.toBe(false);
    expect(useJudgeModeStore.getState().enabled).toBe(false);
  });

  // "꺼짐으로 안다"와 "아직 모른다"가 갈려야 한다. 업데이트 직후 첫 실행에서 후자를 전자로
  // 취급하면 web이 켜 두었던 모드를 덮어쓴다(webViewBootstrapScript.ts).
  it('저장값이 없으면 "본 적 없음"으로 남는다', async () => {
    mocks.readAppSetting.mockResolvedValue(null);
    const { restoreJudgeMode, isJudgeModeStored } = await import('./judgeModePersistence');

    await restoreJudgeMode();

    expect(isJudgeModeStored()).toBe(false);
  });

  it("저장값이 'false'면 \"꺼짐으로 안다\"로 본다", async () => {
    mocks.readAppSetting.mockResolvedValue('false');
    const { restoreJudgeMode, isJudgeModeStored } = await import('./judgeModePersistence');

    await restoreJudgeMode();

    expect(isJudgeModeStored()).toBe(true);
  });

  it('한 번 저장하면 그 뒤로는 앱이 주인이다', async () => {
    mocks.readAppSetting.mockResolvedValue(null);
    mocks.writeAppSetting.mockResolvedValue(undefined);
    const { restoreJudgeMode, persistJudgeMode, isJudgeModeStored } = await import('./judgeModePersistence');

    await restoreJudgeMode();
    await persistJudgeMode(true);

    expect(isJudgeModeStored()).toBe(true);
  });

  // 던지면 부트스트랩이 통째로 실패해 앱이 스플래시에서 멈춘다 — 모드는 그 대가를 치를 값이 아니다
  it('저장소를 못 읽어도 던지지 않고 꺼짐으로 진행한다', async () => {
    mocks.readAppSetting.mockRejectedValue(new Error('db 없음'));
    const { restoreJudgeMode } = await import('./judgeModePersistence');

    await expect(restoreJudgeMode()).resolves.toBe(false);
  });
});

describe('persistJudgeMode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    [true, 'true'],
    [false, 'false'],
  ])('%s를 %s로 남긴다', async (enabled, written) => {
    mocks.writeAppSetting.mockResolvedValue(undefined);
    const { persistJudgeMode } = await import('./judgeModePersistence');

    await persistJudgeMode(enabled);

    expect(mocks.writeAppSetting).toHaveBeenCalledWith('judgeMode', written);
  });

  it('저장에 실패해도 던지지 않는다 — 이번 실행은 그대로 동작한다', async () => {
    mocks.writeAppSetting.mockRejectedValue(new Error('디스크 가득'));
    const { persistJudgeMode } = await import('./judgeModePersistence');

    await expect(persistJudgeMode(true)).resolves.toBeUndefined();
  });
});
