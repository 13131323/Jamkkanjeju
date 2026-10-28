/**
 * 초대 링크를 다른 앱으로 넘길 때의 본문과, 시트가 보여 줄 공유 방법 목록.
 *
 * Android의 `Share.share`는 `url` 필드를 무시하므로 링크를 본문에 담아야 한다
 * (together.tsx가 원래 쓰던 방식 그대로다). 문구와 링크가 붙는 규칙이 화면과 시트 두 곳으로
 * 갈라지면 공유되는 글이 경로마다 달라지므로 여기 한 곳에서만 만든다.
 *
 * 라인·문자·메일 URL까지 이 파일에 둔 이유는 react-native를 import하지 않고 순수 함수로 검증하기
 * 위해서다 — 시트 컴포넌트는 vitest에서 렌더할 수 없다. 같은 이유로 아이콘(SVG)은 여기 없다.
 */

/** 링크 앞에 붙는 한 줄. 협동 미션 톤(coopMission.ts의 "함께 귤나무 키울 일행을 초대해요")에 맞춘다 */
export const INVITE_SHARE_HEADLINE = '함께 귤나무를 키워요!';

/**
 * 공유 본문을 만든다.
 *
 * 링크가 비어 있으면 안내 문구만 남아 받는 사람이 들어올 방법이 없다.
 * 그런 글을 보내느니 아무것도 보내지 않는 편이 낫기 때문에 호출부가 구분할 수 있도록 빈 문자열을 준다.
 */
export function buildInviteShareMessage(inviteUrl: string): string {
  const url = inviteUrl.trim();
  if (url === '') return '';
  return `${INVITE_SHARE_HEADLINE}\n${url}`;
}

/** `Platform.OS` 중 이 파일이 구분해야 하는 값만. 나머지 플랫폼은 Android 규칙을 따른다 */
export type SharePlatform = 'ios' | 'android';

/**
 * 라인으로 넘길 URL.
 *
 * 라인은 **본문을 채워 보내는 공식 경로가 있다** — `https://line.me/R/msg/text/?{인코딩된 본문}`이
 * 라인 문서의 텍스트 공유 링크이고, 경로 뒤 쿼리 전체가 곧 본문이라 키 이름 없이 인코딩한 글만 붙인다.
 * 그래서 이 원은 폴백에 기대는 자리가 아니라 실제로 라인 대화 선택 화면까지 가는 버튼이다.
 *
 * 커스텀 스킴(`line://`)이 아니라 `https`를 쓰는 것이 중요하다. Android 11+는 커스텀 스킴을 열 때
 * 패키지 가시성(`<queries>`) 선언을 요구하는데, `https`는 이 저장소 매니페스트가 이미 선언한 VIEW
 * 인텐트로 처리되므로 매니페스트를 건드리지 않아도 된다. 덤으로 라인이 깔려 있지 않은 기기에서는
 * 브라우저가 같은 주소를 열어 안내 페이지로 이어진다 — 어느 쪽이든 화면이 뜬다.
 *
 * 본문 규칙(빈 링크면 빈 문자열)은 `buildSmsShareUrl`·`buildMailShareUrl`과 같다.
 */
export function buildLineShareUrl(inviteUrl: string): string {
  const message = buildInviteShareMessage(inviteUrl);
  if (message === '') return '';
  return `https://line.me/R/msg/text/?${encodeURIComponent(message)}`;
}

/**
 * 문자 앱으로 넘길 URL.
 *
 * iOS와 Android가 본문 파라미터 앞 구분자를 다르게 읽는다 — iOS는 `sms:&body=`라야 본문이 채워지고
 * Android는 `sms:?body=`를 쓴다. 플랫폼을 상수로 박지 않고 인자로 받는 건 두 경우를 모두
 * 테스트에서 확인하려는 것이다(여기서 `Platform`을 import하면 vitest가 못 읽는다).
 */
export function buildSmsShareUrl(inviteUrl: string, platform: SharePlatform): string {
  const message = buildInviteShareMessage(inviteUrl);
  if (message === '') return '';
  const separator = platform === 'ios' ? '&' : '?';
  return `sms:${separator}body=${encodeURIComponent(message)}`;
}

/**
 * 메일 앱으로 넘길 URL.
 *
 * 받는 사람을 비워 두는 건 이 시트가 상대를 모르기 때문이다 — 주소는 메일 앱에서 고르게 한다.
 * 제목에 안내 문구를 한 번 더 넣으면 본문을 열기 전에도 무슨 메일인지 보인다.
 */
export function buildMailShareUrl(inviteUrl: string): string {
  const message = buildInviteShareMessage(inviteUrl);
  if (message === '') return '';
  return `mailto:?subject=${encodeURIComponent(INVITE_SHARE_HEADLINE)}&body=${encodeURIComponent(message)}`;
}

/** 원형 아이콘 하나가 눌렸을 때 시트가 실행할 동작. 라벨이 아니라 id로 갈라야 문구를 바꿔도 동작이 안 흔들린다 */
export type InviteShareActionId = 'line' | 'sms' | 'mail' | 'more';

export interface InviteShareAction {
  id: InviteShareActionId;
  /** 원 아래 한 줄 라벨(시안 기준) */
  label: string;
  /**
   * 실제로 실행되는 경로.
   *
   * - `direct`: 그 앱을 여는 URL이 있어 `Linking.openURL`로 곧장 연다(열지 못하면 OS 공유 시트로 폴백).
   * - `os-sheet`: 그 앱으로 곧장 넘길 공개 경로가 없어 처음부터 OS 공유 시트를 띄운다.
   *
   * 이 구분을 데이터로 들고 있는 건 "눌러도 아무 일이 없는 버튼"을 만들지 않기 위해서다 —
   * 두 갈래 모두 끝에는 반드시 무언가가 열린다.
   */
  route: 'direct' | 'os-sheet';
}

/**
 * 시트가 보여 주는 공유 방법 4개. 순서·치수는 시안(ShareBottomSheetContainer.png) 그대로이고,
 * 첫 칸만 라인이다.
 *
 * **라인이 `direct`인 이유 — 본문을 채워 넘기는 공식 링크가 있다.**
 *
 * 1. `https://line.me/R/msg/text/?{인코딩된 본문}`은 라인이 문서로 공개한 텍스트 공유 주소다.
 *    받는 사람을 몰라도 되고(대화 상대는 라인이 고르게 한다) 본문에 초대 링크를 그대로 실어 보낸다 —
 *    이 시트가 필요한 두 가지가 다 된다.
 * 2. `https`라 Android 11+의 패키지 가시성 제약을 받지 않는다. 커스텀 스킴이었다면 매니페스트에
 *    `<queries>`를 더해야 했지만, https VIEW 인텐트는 이미 선언돼 있어 네이티브 설정을 건드리지 않는다.
 * 3. 라인이 깔려 있으면 앱이, 없으면 브라우저가 같은 주소를 연다. 어느 쪽이든 사용자는 다음 화면을 본다.
 *
 * 그래도 `openURL`은 실패할 수 있어(브라우저조차 없는 기기, 정책으로 막힌 인텐트) 문자·메일과 똑같이
 * OS 공유 시트로 폴백한다. 실제 기기 검증을 아직 못 했으니 이 안전망은 남겨 둔다.
 *
 * **더보기**는 OS 공유 시트다. "누르면 다른 앱들을 보여 준다"가 이 자리의 역할이라서,
 * 설치된 앱 목록을 아는 유일한 주체(OS)에게 그대로 넘긴다. 기기에 어떤 공유 앱이 깔려 있는지
 * 조회하는 공개 API가 React Native에도 Expo 56에도 없어서 이 앱이 목록을 직접 그릴 방법은 없다.
 */
export const INVITE_SHARE_ACTIONS: readonly InviteShareAction[] = [
  { id: 'line', label: '라인', route: 'direct' },
  { id: 'sms', label: '문자', route: 'direct' },
  { id: 'mail', label: '메일', route: 'direct' },
  { id: 'more', label: '더보기', route: 'os-sheet' },
];
