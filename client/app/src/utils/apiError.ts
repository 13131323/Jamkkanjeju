/**
 * 에러 응답 바디의 `code`를 읽는다.
 *
 * axios를 import하지 않는다 — 이 모듈은 테스트에서 그대로 읽혀야 하고, 필요한 건
 * `error.response.data.code` 한 겹뿐이다. 형태가 다르면(네트워크 실패 등) undefined다.
 *
 * 보물찾기 상수 파일(`constants/treasureMission.ts`)에 있던 것을 옮겼다. 협동 미션도 같은 함수가
 * 필요해졌는데, 한 도메인의 상수 파일을 다른 도메인이 import하면 둘이 서로를 끌고 다니게 된다.
 * 이 함수에는 도메인 지식이 없다 — 어느 API의 에러든 모양이 같다.
 */
export function readApiErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;

  const response = (error as { response?: unknown }).response;
  if (typeof response !== 'object' || response === null) return undefined;

  const data = (response as { data?: unknown }).data;
  if (typeof data !== 'object' || data === null) return undefined;

  const code = (data as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

/** 에러의 HTTP status. 응답을 못 받았으면 undefined다 */
export function readApiErrorStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined;

  const response = (error as { response?: unknown }).response;
  if (typeof response !== 'object' || response === null) return undefined;

  const status = (response as { status?: unknown }).status;
  return typeof status === 'number' ? status : undefined;
}

/** 한 줄 안내에 들어갈 수 있는 바디 길이. 넘으면 잘라 낸다 */
const MAX_BODY_LENGTH = 200;

/**
 * 응답 바디를 한 줄 문자열로. 읽을 수 없으면 undefined다.
 *
 * `JSON.stringify`는 순환 참조에서 throw하고, axios 에러 바디에는 응답 객체가 되돌아 붙어 있는
 * 경우가 있다. 디버깅용 문구를 만들다가 새 에러를 던지면 원래 에러를 영영 못 보므로 감싼다.
 */
function readApiErrorBody(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;

  const response = (error as { response?: unknown }).response;
  if (typeof response !== 'object' || response === null) return undefined;

  const data = (response as { data?: unknown }).data;
  if (data === undefined || data === null) return undefined;
  if (typeof data === 'string') return data;

  try {
    return JSON.stringify(data) ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * 에러를 사람이 읽을 수 있는 한 줄로 만든다. **디버깅용 문구다.**
 *
 * 협동 미션 "시작하기"가 실패했을 때 `readApiErrorCode`가 undefined를 돌려주면 화면에는 일반 문구만
 * 남아 서버가 무엇을 거절했는지 알 수 없다. 그래서 code가 없을 때는 status와 응답 바디를 대신 보여
 * 준다 — "무엇이 왔는지"가 보여야 원인을 좁힐 수 있다.
 *
 * 사용자에게 보이는 안내 문구가 아니므로 번역하거나 다듬지 않는다. 대신 어떤 입력에도 throw하지
 * 않아야 한다. 에러를 설명하다가 에러가 나면 원래 에러가 사라진다.
 */
export function describeApiError(error: unknown): string {
  const code = readApiErrorCode(error);
  const status = readApiErrorStatus(error);

  if (status === undefined) {
    if (code !== undefined) return code;

    const message = typeof error === 'object' && error !== null ? (error as { message?: unknown }).message : undefined;
    return `요청 실패 · ${typeof message === 'string' ? message : '알 수 없는 오류'}`;
  }

  // code가 있으면 그것이 가장 구체적인 정보다. 바디는 같은 내용을 반복할 뿐이라 붙이지 않는다.
  if (code !== undefined) return `HTTP ${status} · ${code}`;

  const body = readApiErrorBody(error);
  if (body === undefined) return `HTTP ${status}`;

  const shortBody = body.length > MAX_BODY_LENGTH ? `${body.slice(0, MAX_BODY_LENGTH)}…` : body;
  return `HTTP ${status} · ${shortBody}`;
}
