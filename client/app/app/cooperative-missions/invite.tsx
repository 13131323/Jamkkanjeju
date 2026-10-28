import { CoopInviteEntry } from '@/components/Coop/CoopInviteEntry/CoopInviteEntry';

/**
 * Android App Link 초대 진입 — `https://{web}/cooperative-missions/invite?token=…`.
 *
 * **이 파일 경로는 공유되는 https 링크의 경로와 글자 그대로 같아야 한다.**
 * App Link는 커스텀 스킴처럼 주소를 바꿔 주지 않고 https URL을 그대로 앱에 넘기며,
 * expo-router는 origin만 떼고 남은 경로로 라우트를 찾는다
 * (`expo-router/build/fork/extractPathFromURL.js`). 그래서
 *
 *   `app/cooperative-missions/invite.tsx`
 *   ↔ `app.json`의 `intentFilters[].data.pathPrefix`
 *   ↔ `src/config/inviteUrl.ts`의 `COOP_INVITE_PATH`
 *   ↔ web의 `src/app/cooperative-missions/invite/page.tsx`
 *
 * 네 자리가 하나라도 어긋나면 앱은 열리는데 초대 화면이 뜨지 않는다.
 * 네 자리의 일치는 `src/config/appLinks.test.ts`가 고정한다.
 *
 * 화면 내용은 커스텀 스킴 진입(`app/mission/invite.tsx`)과 완전히 같아야 하므로
 * 로직은 `CoopInviteEntry` 한 곳에만 둔다.
 */
export default function CoopInviteAppLinkScreen() {
  return <CoopInviteEntry />;
}
