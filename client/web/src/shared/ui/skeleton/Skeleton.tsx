import type { CSSProperties, ReactNode } from 'react';

type SkeletonTone = 'light' | 'onDark';

const TONE_CLASS: Record<SkeletonTone, string> = {
  light: 'bg-warm-neutral-100',
  onDark: 'bg-cool-neutral-white/20',
};

/**
 * 로딩 중 자리표시 블록 하나. 치수·radius는 className으로 준다(예: `h-4 w-20 rounded`).
 * 화면 배경이 흰색 계열이면 `light`(기본), 홈 히어로·방명록처럼 어둡거나 반투명한 배경이면 `onDark`를 쓴다.
 * 개별 블록에는 접근성 라벨을 달지 않는다 — 화면(섹션) 단위로 `SkeletonGroup`이 한 번만 안내한다.
 */
export function Skeleton({ className = '', tone = 'light', style }: { className?: string; tone?: SkeletonTone; style?: CSSProperties }) {
  return <div aria-hidden="true" style={style} className={`${TONE_CLASS[tone]} animate-pulse rounded ${className}`} />;
}

/** 스크린리더에 "불러오는 중"을 화면 단위로 한 번만 알리는 래퍼. */
export function SkeletonGroup({ children, className = '', style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div role="status" aria-label="불러오는 중" style={style} className={className}>
      {children}
    </div>
  );
}
