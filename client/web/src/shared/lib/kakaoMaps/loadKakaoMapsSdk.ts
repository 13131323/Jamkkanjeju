'use client';

import { useEffect, useState } from 'react';
import { env } from '@shared/config/env';

// libraries=services: 좌표→주소 변환(Geocoder) 사용을 위해 필요
const SDK_SRC = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${env.NEXT_PUBLIC_KAKAO_MAP_KEY}&autoload=false&libraries=services`;

// 페이지 내 여러 컴포넌트가 훅을 동시에 써도 스크립트 태그는 한 번만 삽입되도록 모듈 레벨에서 공유
let loadPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    if (window.kakao?.maps) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = SDK_SRC;
    script.async = true;
    script.onload = () => window.kakao.maps.load(resolve);
    script.onerror = () => reject(new Error('카카오맵 SDK 로드 실패'));
    document.head.appendChild(script);
  });

  return loadPromise;
}

export function useKakaoMapsSdk(): { loaded: boolean; error: Error | null } {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    loadScript()
      .then(() => {
        if (!cancelled) setLoaded(true);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { loaded, error };
}
