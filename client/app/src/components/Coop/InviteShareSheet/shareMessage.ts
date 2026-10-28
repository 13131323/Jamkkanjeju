/**
 * 협동 미션 초대 링크를 공유할 때의 문구.
 *
 * **본문·URL을 조립하는 규칙 자체는 여기 없다** — AI 엽서도 같은 모양으로 공유하게 되면서
 * `@packages/shared`의 `share/shareMessage.ts`로 옮겼다. 규칙이 web·app 두 곳에 복사돼 있으면
 * 한쪽만 고쳐졌을 때 보내는 글이 경로마다 달라진다.
 * **시트가 보여 주는 원 4개의 목록**도 무엇을 공유하든 같아서 `components/Share/ShareSheet`로 옮겼다.
 *
 * 이 파일에 남은 것은 **초대에만 해당하는 값**(안내 문구)과, 옮겨 간 것들을 옛 이름으로 잇는 얇은 층뿐이다.
 * 이름·시그니처를 그대로 두는 건 이 흐름의 테스트(shareMessage.test.ts)가 초대 문구가 붙은 결과를
 * 검증하고 있어서다 — 옮기면서 초대가 실제로 보내는 글이 달라지지 않았다는 근거가 그 테스트다.
 */
import { buildLineShareUrl as buildLineUrl, buildMailShareUrl as buildMailUrl, buildShareMessage, buildSmsShareUrl as buildSmsUrl, type ShareContent, type SharePlatform } from '@packages/shared';
import { SHARE_ACTIONS, type ShareAction, type ShareActionId } from '@/components/Share/ShareSheet/shareActions';

export type { SharePlatform };

/** 링크 앞에 붙는 한 줄. 협동 미션 톤(coopMission.ts의 "함께 귤나무 키울 일행을 초대해요")에 맞춘다 */
export const INVITE_SHARE_HEADLINE = '함께 귤나무를 키워요!';

/**
 * 초대 링크 하나를 공유 규칙이 받는 형태로 옮긴다. 메일 제목은 안내 문구를 그대로 쓴다(기존 동작).
 *
 * 시트에 그대로 넘기는 값이기도 하다 — 공용 시트는 `ShareContent` 하나만 받고 초대인지 모른다.
 */
export function inviteShareContent(inviteUrl: string): ShareContent {
  return { headline: INVITE_SHARE_HEADLINE, url: inviteUrl };
}

/**
 * 공유 본문을 만든다.
 *
 * 링크가 비어 있으면 안내 문구만 남아 받는 사람이 들어올 방법이 없다.
 * 그런 글을 보내느니 아무것도 보내지 않는 편이 낫기 때문에 호출부가 구분할 수 있도록 빈 문자열을 준다.
 */
export function buildInviteShareMessage(inviteUrl: string): string {
  return buildShareMessage(inviteShareContent(inviteUrl));
}

/** 라인으로 넘길 URL. 왜 https 텍스트 공유 링크인지는 공용 규칙(share/shareMessage.ts) 주석 참고 */
export function buildLineShareUrl(inviteUrl: string): string {
  return buildLineUrl(inviteShareContent(inviteUrl));
}

/** 문자 앱으로 넘길 URL. iOS·Android가 본문 구분자를 다르게 읽어 플랫폼을 인자로 받는다 */
export function buildSmsShareUrl(inviteUrl: string, platform: SharePlatform): string {
  return buildSmsUrl(inviteShareContent(inviteUrl), platform);
}

/** 메일 앱으로 넘길 URL. 받는 사람은 비우고 제목·본문만 채운다 */
export function buildMailShareUrl(inviteUrl: string): string {
  return buildMailUrl(inviteShareContent(inviteUrl));
}

/**
 * 시트 UI의 목록은 공용 시트(`components/Share/ShareSheet/shareActions.ts`)로 옮겼다.
 * 이 흐름의 테스트가 옛 이름으로 순서·라벨을 검증하고 있어 이름만 이어 준다 — 값은 같은 배열이다.
 */
export type InviteShareActionId = ShareActionId;
export type InviteShareAction = ShareAction;
export const INVITE_SHARE_ACTIONS: readonly InviteShareAction[] = SHARE_ACTIONS;
