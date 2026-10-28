/**
 * 링크 하나를 다른 앱(라인·문자·메일·OS 공유 시트)으로 넘길 때의 **본문과 주소 조립 규칙**.
 *
 * 원래 이 규칙은 협동 미션 초대 시트 안(app/src/components/Coop/InviteShareSheet/shareMessage.ts)에만
 * 있었고 초대 링크 전용이었다. AI 엽서도 같은 모양의 공유가 필요해지면서,
 * **문구가 경로마다 갈라지지 않도록** 무엇을 공유하든 쓸 수 있는 형태로 여기로 옮겼다 —
 * 같은 규칙을 web과 app이 각자 복사해 두면 한쪽만 고쳐졌을 때 보내는 글이 달라진다.
 *
 * 여기 있는 것은 **순수 함수뿐**이다. 실제로 여는 일(`Linking.openURL`, `navigator.share`)은
 * 플랫폼 API가 달라 각 패키지의 컴포넌트가 맡는다. 그 덕에 이 규칙만 따로 테스트할 수 있다.
 */

/** 공유 한 건이 담는 것 전부. 컴포넌트는 이 덩어리를 props로 받아 그대로 넘기면 된다 */
export interface ShareContent {
  /**
   * 링크 앞줄에 붙는 안내 한 줄. 라인·문자·메일 본문이 모두 이 문구를 쓴다.
   *
   * 화면마다 다른 말을 해야 해서(초대는 "함께 귤나무를 키워요!", 엽서는 엽서다운 문구) 상수가 아니라
   * 값으로 받는다.
   */
  headline: string;
  /** 실제로 공유되는 주소. 초대 링크일 수도, 엽서 이미지 주소일 수도 있다 */
  url: string;
  /**
   * 메일 제목. 생략하면 `headline`을 그대로 쓴다.
   *
   * 본문을 열기 전에도 무슨 메일인지 보이게 하려는 자리라 대개 headline과 같지만,
   * 제목에는 느낌표 없이 짧게 쓰고 싶은 경우가 있어 따로 뺄 수 있게 두었다.
   */
  mailSubject?: string;
}

/** `Platform.OS` 중 이 파일이 구분해야 하는 값만. 나머지 플랫폼은 Android 규칙을 따른다 */
export type SharePlatform = 'ios' | 'android';

/**
 * 공유 본문을 만든다.
 *
 * Android의 `Share.share`는 `url` 필드를 무시하므로 링크를 본문에 담아야 한다 — 그래서 본문과 링크를
 * 붙이는 규칙이 이 한 곳에만 있어야 한다.
 *
 * **링크가 비어 있으면 빈 문자열을 준다.** 안내 문구만 남은 글은 받는 사람이 들어올 방법이 없고,
 * 그런 글을 보내느니 아무것도 보내지 않는 편이 낫다 — 호출부가 `=== ''`로 구분해 아예 열지 않는다.
 *
 * 안내 문구가 비어 있을 때 앞줄을 통째로 빼는 건, `'\n' + url`처럼 빈 줄로 시작하는 글이
 * 메신저에서 주소가 잘린 것처럼 보이기 때문이다.
 */
export function buildShareMessage({ headline, url }: ShareContent): string {
  // 앞뒤 공백이 섞인 주소를 링크로 인식하지 못하는 앱이 있다
  const trimmedUrl = url.trim();
  if (trimmedUrl === '') return '';

  const trimmedHeadline = headline.trim();
  if (trimmedHeadline === '') return trimmedUrl;
  return `${trimmedHeadline}\n${trimmedUrl}`;
}

/**
 * 라인으로 넘길 URL.
 *
 * 라인은 **본문을 채워 보내는 공식 경로가 있다** — `https://line.me/R/msg/text/?{인코딩된 본문}`이
 * 라인 문서의 텍스트 공유 링크이고, 경로 뒤 쿼리 전체가 곧 본문이라 키 이름 없이 인코딩한 글만 붙인다.
 * 그래서 라인 버튼은 폴백에 기대는 자리가 아니라 실제로 대화 선택 화면까지 가는 버튼이다.
 *
 * 커스텀 스킴(`line://`)이 아니라 `https`를 쓰는 것이 중요하다. Android 11+는 커스텀 스킴을 열 때
 * 패키지 가시성(`<queries>`) 선언을 요구하는데, `https`는 이 저장소 매니페스트가 이미 선언한 VIEW
 * 인텐트로 처리되므로 네이티브 설정을 건드리지 않아도 된다. 덤으로 라인이 깔려 있지 않은 기기에서는
 * 브라우저가 같은 주소를 열어 안내 페이지로 이어진다 — 어느 쪽이든 화면이 뜬다.
 */
export function buildLineShareUrl(content: ShareContent): string {
  const message = buildShareMessage(content);
  if (message === '') return '';
  return `https://line.me/R/msg/text/?${encodeURIComponent(message)}`;
}

/**
 * 문자 앱으로 넘길 URL.
 *
 * iOS와 Android가 본문 파라미터 앞 구분자를 다르게 읽는다 — iOS는 `sms:&body=`라야 본문이 채워지고
 * Android는 `sms:?body=`를 쓴다. 플랫폼을 상수로 박지 않고 인자로 받는 건 두 경우를 모두
 * 테스트에서 확인하려는 것이다(여기서 `Platform`을 import하면 web도 vitest도 못 읽는다).
 */
export function buildSmsShareUrl(content: ShareContent, platform: SharePlatform): string {
  const message = buildShareMessage(content);
  if (message === '') return '';
  const separator = platform === 'ios' ? '&' : '?';
  return `sms:${separator}body=${encodeURIComponent(message)}`;
}

/**
 * 메일 앱으로 넘길 URL.
 *
 * 받는 사람을 비워 두는 건 공유하는 쪽이 상대를 모르기 때문이다 — 주소는 메일 앱에서 고르게 한다.
 * 제목에 안내 문구를 한 번 더 넣으면 본문을 열기 전에도 무슨 메일인지 보인다.
 */
export function buildMailShareUrl(content: ShareContent): string {
  const message = buildShareMessage(content);
  if (message === '') return '';
  // 제목을 따로 주지 않았으면 안내 문구가 곧 제목이다(협동 미션 초대 시트가 쓰던 규칙 그대로)
  const subject = (content.mailSubject ?? content.headline).trim();
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
}
