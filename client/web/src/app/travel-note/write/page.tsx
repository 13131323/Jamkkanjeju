import { Suspense } from 'react';
import { TravelNoteWritePage } from '@/_pages/travel-note-write';

export default function Page() {
  // TravelNoteWritePage가 useSearchParams(전달받은 장소/좌표 정보)를 쓰므로 Suspense 경계가 필요하다.
  return (
    <Suspense fallback={null}>
      <TravelNoteWritePage />
    </Suspense>
  );
}
