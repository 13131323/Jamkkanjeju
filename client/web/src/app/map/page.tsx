import { Suspense } from 'react';
import { MapPage } from '@/_pages/map';

export default function Page() {
  // MapView가 useSearchParams(mode=treasure 분기)를 쓰므로 Suspense 경계가 필요하다.
  return (
    <Suspense fallback={null}>
      <MapPage />
    </Suspense>
  );
}
