'use client';

import { useRef, type CSSProperties } from 'react';
import Image from 'next/image';
import navImageDefault from '@shared/lib/images/nav-image-default.png';
import navImageOpened from '@shared/lib/images/nav-image-opened.png';

const DEFAULT_TOOLTIP_LABEL = '눌러보게';

/**
 * `onLongPress`가 발동하기까지 누르고 있어야 하는 시간(ms).
 *
 * 일반 탭과 확실히 갈라야 해서 길게 잡는다 — 이 제스처는 심사위원용 모드처럼 실제 사용자가
 * 실수로 밟으면 안 되는 곳에 쓴다(web/src/entities/location/model/judgeMode.ts).
 */
const LONG_PRESS_MS = 3000;

// 마스코트(nav-image) 버튼 — 클릭 시 NavMenuModal을 여는 트리거. home/map/travel-note 공용(마이페이지는 표시 안 함).
// className에 반드시 relative/absolute 등 포지셔닝을 포함해야 한다(내부 툴팁이 이 요소 기준 absolute로 배치됨).
// tooltipLabel: 화면마다 툴팁 문구가 달라 홈은 기본값("눌러보게"), map/travel-note는 "메뉴"를 넘긴다.
export function NavMenuButton({
  isOpen,
  onClick,
  onLongPress,
  className,
  style,
  tooltipLabel = DEFAULT_TOOLTIP_LABEL,
}: {
  isOpen: boolean;
  onClick: () => void;
  /** LONG_PRESS_MS 이상 누르고 있으면 호출된다. 넘기지 않으면 일반 버튼으로 동작한다 */
  onLongPress?: () => void;
  className: string;
  style?: CSSProperties;
  tooltipLabel?: string;
}) {
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 길게 눌러 발동한 뒤 손을 떼면 click도 이어서 오므로, 그 한 번을 삼켜 메뉴가 함께 열리지 않게 한다
  const didLongPressRef = useRef(false);

  function startHold() {
    if (!onLongPress) return;
    didLongPressRef.current = false;
    holdTimerRef.current = setTimeout(() => {
      didLongPressRef.current = true;
      onLongPress();
    }, LONG_PRESS_MS);
  }

  function cancelHold() {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }

  function handleClick() {
    if (didLongPressRef.current) {
      didLongPressRef.current = false;
      return;
    }
    onClick();
  }

  return (
    <div className={`h-16 w-16 ${className}`} style={style}>
      <button
        type="button"
        aria-label="메뉴 열기"
        onClick={handleClick}
        onPointerDown={startHold}
        onPointerUp={cancelHold}
        onPointerLeave={cancelHold}
        onPointerCancel={cancelHold}
        className="relative h-full w-full"
      >
        <Image src={isOpen ? navImageOpened : navImageDefault} alt="" aria-hidden="true" fill sizes="64px" className="object-contain" />
      </button>

      <NavMenuTooltip label={tooltipLabel} />
    </div>
  );
}

function NavMenuTooltip({ label }: { label: string }) {
  return (
    <div className="absolute top-1/2 left-full ml-3 -translate-y-1/2">
      <span className="bg-cool-neutral-900 absolute top-1/2 -left-1 h-3 w-3 -translate-y-1/2 rotate-45 rounded-bl-sm" aria-hidden="true" />
      <div className="bg-cool-neutral-900 rounded-md py-1.5 pr-3 pl-[14.34px]">
        <p className="text-label-sm text-cool-neutral-white font-medium whitespace-nowrap">{label}</p>
      </div>
    </div>
  );
}
