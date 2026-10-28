'use client';

import { useState, type ReactNode } from 'react';
import { toHttpsImageUrl } from '@shared/lib/imageUrl';

/**
 * 원격 이미지. 받는 동안은 스켈레톤이고, 실패하면 "이미지 없음" 자리표시로 끝난다.
 * 깨진 이미지 아이콘을 그대로 두면 레이아웃만 남고 이유를 알 수 없다.
 */
export function SkeletonImage({ src, className, children, failedBgClass = 'bg-warm-neutral-200' }: { src: string; className: string; children?: ReactNode; failedBgClass?: string }) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'failed'>('loading');

  if (status === 'failed') {
    return <div className={`${failedBgClass} ${className}`}>{children}</div>;
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {status === 'loading' && <div className="bg-warm-neutral-200 absolute inset-0 animate-pulse" aria-hidden="true" />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={toHttpsImageUrl(src)}
        alt=""
        className={status === 'loaded' ? 'h-full w-full object-cover' : 'h-full w-full object-cover opacity-0'}
        onLoad={() => setStatus('loaded')}
        onError={() => setStatus('failed')}
      />
    </div>
  );
}
