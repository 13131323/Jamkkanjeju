import { Suspense } from 'react';
import { TravelNotePage } from '@/_pages/travel-note';

export default function Page() {
  // TravelNotePage가 useSearchParams(지도 상세에서 넘어온 location 칩)를 쓰므로 Suspense 경계가 필요하다.
  return (
    <Suspense fallback={null}>
      <TravelNotePage />
    </Suspense>
  );
}
