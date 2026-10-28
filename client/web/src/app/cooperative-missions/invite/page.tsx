import { Suspense } from 'react';
import { InviteRedirect } from './InviteRedirect';

export default function Page() {
  // InviteRedirect가 useSearchParams(초대 토큰)를 쓰므로 Suspense 경계가 필요하다.
  return (
    <Suspense fallback={null}>
      <InviteRedirect />
    </Suspense>
  );
}
