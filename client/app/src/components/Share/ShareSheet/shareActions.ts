/**
 * 공유 시트가 보여 주는 원 4개의 목록.
 *
 * 원래는 협동 미션 초대 시트 안(`Coop/InviteShareSheet/shareMessage.ts`)에 있었다. 무엇을 공유하든
 * 고르는 방법은 같아서(라인·문자·메일·더보기) 시트와 함께 여기로 옮겼고, **순서·라벨·경로는 하나도
 * 바꾸지 않았다.** 초대 시트가 쓰던 이름(`INVITE_SHARE_ACTIONS` 등)은 그쪽에서 그대로 re-export한다.
 *
 * 무엇을 공유할지(문구·링크)는 이 파일이 모른다 — 시트가 `ShareContent`로 받고, 본문·URL 조립은
 * `@packages/shared`의 공용 순수 함수가 한다.
 */

/** 원형 아이콘 하나가 눌렸을 때 시트가 실행할 동작. 라벨이 아니라 id로 갈라야 문구를 바꿔도 동작이 안 흔들린다 */
export type ShareActionId = 'line' | 'sms' | 'mail' | 'more';

export interface ShareAction {
  id: ShareActionId;
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
 *    받는 사람을 몰라도 되고(대화 상대는 라인이 고르게 한다) 본문에 링크를 그대로 실어 보낸다 —
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
export const SHARE_ACTIONS: readonly ShareAction[] = [
  { id: 'line', label: '라인', route: 'direct' },
  { id: 'sms', label: '문자', route: 'direct' },
  { id: 'mail', label: '메일', route: 'direct' },
  { id: 'more', label: '더보기', route: 'os-sheet' },
];
