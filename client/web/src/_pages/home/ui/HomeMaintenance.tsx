'use client';

import { useSyncExternalStore } from 'react';
import { MaintenanceDialog } from '@shared/ui/MaintenanceDialog';
import { sendToApp } from '@shared/lib/bridge/utils';
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

/** 홈에서는 점검 정보와 종료 버튼만 제공한다. 일반 웹의 종료 버튼은 동작하지 않는다. */
export function MaintenanceInProgress({ maintenance }: { maintenance: HomeMaintenance | null }) {
  return (
    <HomeMaintenanceBackground>
      <MaintenanceDialog
        message={maintenance?.status === 'IN_PROGRESS' ? maintenance.message : '현재 서비스 점검 중입니다.'}
        period={maintenance?.status === 'IN_PROGRESS' ? formatMaintenancePeriod(maintenance.startsAt, maintenance.endsAt) : undefined}
        actionLabel="종료하기"
        onAction={() => sendToApp({ type: 'EXIT_APP', payload: {} })}
      />
    </HomeMaintenanceBackground>
  );
}
