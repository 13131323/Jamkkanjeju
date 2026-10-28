import { CoopInviteEntry } from '@/components/Coop/CoopInviteEntry/CoopInviteEntry';

/**
 * 커스텀 스킴 초대 진입 — `tamnalog:///mission/invite?token=…`.
 *
 * web 랜딩(`/cooperative-missions/invite`)의 "앱에서 열기" 버튼이 여는 주소다.
 * Android App Link 검증이 아직 끝나지 않았거나, 인앱 브라우저·데스크톱처럼 App Link가
 * 동작하지 않는 자리에서 앱을 여는 **폴백 경로**이자, iOS의 유일한 경로다
 * (이번 작업은 Android만 다뤘고 iOS는 예전 그대로 이 스킴을 쓴다).
 *
 * https App Link는 경로가 달라 여기가 아니라 `app/cooperative-missions/invite.tsx`로 들어온다.
 * 두 파일은 같은 컴포넌트를 부르므로 어느 쪽으로 들어와도 동작이 같다 —
 * 이유와 근거는 `CoopInviteEntry.tsx` 주석에 있다.
 *
 * 이 경로 문자열은 `src/config/inviteUrl.ts`의 `COOP_INVITE_APP_PATH`와 같아야 하고,
 * 그 일치는 `src/config/appLinks.test.ts`가 파일 존재로 고정한다.
 */
export default function CoopInviteSchemeScreen() {
  return <CoopInviteEntry />;
}
