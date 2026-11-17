'use client';

import { useEffect, useId, useRef, useSyncExternalStore } from 'react';
import Image from 'next/image';
import type { HomeMaintenance } from '@shared/api/home';
import homeBackImage from '@shared/lib/images/home-back-image.png';
import homeBackImageNight from '@shared/lib/images/home-back-image3.png';
import { getJejuDaylightServerSnapshot, getJejuDaylightSnapshot, subscribeJejuDaylight } from '../model/jejuDaylight';
import { formatMaintenancePeriod } from '../model/maintenanceTime';

/** 진행 중인 미션 카드 아래에 표시하는 작은 예약 공지이다. */
export function ScheduledMaintenanceNotice({ maintenance, isNight }: { maintenance: HomeMaintenance; isNight: boolean }) {
  return (
    <aside
      aria-label="점검 예정 안내"
      className={`absolute right-4 left-4 flex min-h-9 items-center gap-2 rounded-md border px-3 py-2 shadow-[0_4px_20px_rgba(0,0,0,0.1)] backdrop-blur-md ${isNight ? 'border-white/30 bg-black/20 text-white' : 'border-white/60 bg-white/70 text-warm-neutral-900'}`}
      style={{ top: 'calc(var(--safe-area-top) + 90px)' }}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-tertiary-800" />
      <p className="text-label-sm leading-5">
        <span className="mr-2 font-bold">점검 예정</span>
        {formatMaintenancePeriod(maintenance.startsAt, maintenance.endsAt)}
      </p>
    </aside>
  );
}

/** 일반 홈 기능을 마운트하지 않는 조회 대기·점검 화면의 공통 배경이다. */
export function HomeMaintenanceBackground({ children }: { children: React.ReactNode }) {
  const isDaytime = useSyncExternalStore(subscribeJejuDaylight, getJejuDaylightSnapshot, getJejuDaylightServerSnapshot);
  return (
    <div className="relative h-dvh w-full overflow-hidden bg-cool-neutral-white">
      <Image src={isDaytime ? homeBackImage : homeBackImageNight} alt="" aria-hidden="true" fill priority sizes="100vw" className="object-cover" style={{ objectPosition: 'center calc(50% - 46px)' }} />
      {children}
    </div>
  );
}

/** 점검 중에는 안내만 표시하며 배경 터치·Escape·Tab으로 닫거나 홈을 조작할 수 없다. */
export function MaintenanceInProgress({ maintenance }: { maintenance: HomeMaintenance }) {
  const titleId = useId();
  const messageId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    function keepFocus(event: KeyboardEvent) {
      if (event.key === 'Tab' || event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        dialogRef.current?.focus();
      }
    }
    document.addEventListener('keydown', keepFocus, true);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', keepFocus, true);
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  return (
    <HomeMaintenanceBackground>
      <div className="fixed inset-0 z-50 flex touch-none items-center justify-center bg-black/50 px-6 backdrop-blur-md">
        <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={messageId} className="bg-cool-neutral-white flex max-h-[80dvh] w-full max-w-90 touch-pan-y flex-col items-center gap-5 overflow-y-auto rounded-3xl px-6 py-8 text-center shadow-xl outline-none">
          <div aria-hidden="true" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-tertiary-100 text-tertiary-800">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
          </div>
          <h1 id={titleId} className="text-heading-h3 text-warm-neutral-900 font-bold">서비스 점검 중입니다</h1>
          <p id={messageId} className="text-body-md text-warm-neutral-700 w-full whitespace-pre-wrap break-words">{maintenance.message}</p>
          <div className="bg-cool-neutral-100 w-full rounded-2xl px-3 py-4">
            <p className="text-label-sm text-cool-neutral-600 mb-1">점검 시간 (한국시간)</p>
            <p className="text-label-md text-warm-neutral-900 font-semibold">{formatMaintenancePeriod(maintenance.startsAt, maintenance.endsAt)}</p>
          </div>
          <p className="text-body-sm text-cool-neutral-500">점검이 끝난 후 다시 이용해 주세요.</p>
        </div>
      </div>
    </HomeMaintenanceBackground>
  );
}
