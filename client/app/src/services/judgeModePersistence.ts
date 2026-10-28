/**
 * 심사위원용 모드를 **앱이 보관한다.**
 *
 * 예전 규칙은 "web이 주인, 앱은 메모리"였다. 그래서 앱을 완전히 종료했다 켜면 앱은 항상 기본
 * 모드로 시작해, web이 WebView 안에서 살아나 JUDGE_MODE_UPDATE를 보내 줄 때까지 기다렸다 —
 * 그 구간 동안 네이티브 API 호출은 앱 토큰으로 나가고 좌표도 실측값이 흘렀다(services/authHeader.ts,
 * store/judgeMode.ts의 applyJudgeModePosition). 사용자가 본 "기본모드였다가 심사위원모드로 바뀜"이 이것이다.
 *
 * 지금은 역할을 이렇게 나눈다:
 *   - **앱 = 보관소**: 변경 통지를 받으면 sqlite에 남기고, 다음 실행의 부트스트랩에서 되살린다.
 *   - **web = 편집자**: 켜고 끄는 UI와 코드 모달은 그대로 web에 있다.
 *
 * 양쪽이 각자 "자기 값"을 가지면 상태가 갈라진다는 기존 경고는 그대로 유효하다 — 그래서 앱은
 * 스스로 값을 바꾸지 않고, **받은 값을 그대로 남기기만** 한다. 되살린 값은 WebView에 주입되어
 * web의 출발값이 되므로(components/HomeWebView/judgeModeScript.ts) 한 바퀴가 닫힌다.
 */
import { readAppSetting, writeAppSetting } from '@/db/appSetting';
import { useJudgeModeStore } from '@/store/judgeMode';

const JUDGE_MODE_SETTING_KEY = 'judgeMode';

/**
 * 저장값을 **본 적이 있는가.** "꺼짐으로 안다"와 "아직 모른다"는 다르다.
 *
 * 이 구분이 없으면 업데이트 직후 첫 실행에서 사고가 난다. 그때 AppSetting은 비어 있는데 앱이
 * 그것을 `false`로 심으면, web은 "앱이 꺼짐이라고 했다"로 읽고 자기 localStorage의 켜짐을
 * 덮어쓴다 — 켜 두었던 모드가 업데이트 한 번에 조용히 꺼지고 코드를 다시 넣기 전에는 못 돌아온다.
 *
 * 모른다고 심으면 web이 localStorage로 떨어지고, 그 값이 JUDGE_MODE_UPDATE로 되돌아와 저장된다.
 * 그 뒤부터 앱이 주인이다.
 */
let hasStoredValue = false;

/** 저장값을 본 적이 있는가. WebView에 무엇을 심을지 정하는 데 쓴다(webViewBootstrapScript.ts) */
export function isJudgeModeStored(): boolean {
  return hasStoredValue;
}

/**
 * 저장값을 켜짐/꺼짐으로 접는다. 켜짐만 `'true'`이고 그 외(없음·`'false'`·손상)는 전부 꺼짐이다 —
 * web의 parseStoredJudgeMode와 같은 규칙이라 두 저장소가 같은 문자열을 같은 뜻으로 읽는다.
 */
export function parseStoredJudgeMode(raw: string | null): boolean {
  return raw === 'true';
}

/**
 * sqlite의 값을 스토어로 되살린다. **부트스트랩에서 화면이 뜨기 전에** 부른다.
 *
 * 실패를 삼키는 이유: 모드는 심사용 보조 기능이고, 못 읽었을 때의 손해는 "이번 실행에서 꺼진 채
 * 시작"뿐이다. 여기서 던지면 부트스트랩이 통째로 실패해 앱이 스플래시에서 멈춘다.
 */
export async function restoreJudgeMode(): Promise<boolean> {
  try {
    const raw = await readAppSetting(JUDGE_MODE_SETTING_KEY);
    hasStoredValue = raw !== null;

    const enabled = parseStoredJudgeMode(raw);
    useJudgeModeStore.getState().setEnabled(enabled);
    return enabled;
  } catch {
    return false;
  }
}

/** web에서 모드가 바뀌었다는 통지를 받았을 때 남긴다. 실패해도 이번 실행은 정상 동작한다 */
export async function persistJudgeMode(enabled: boolean): Promise<void> {
  try {
    await writeAppSetting(JUDGE_MODE_SETTING_KEY, enabled ? 'true' : 'false');
    hasStoredValue = true;
  } catch {
    // 저장 실패는 다음 실행에서 잊히는 정도의 손해다 — web의 persist와 같은 판단
  }
}
