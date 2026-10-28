'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import iconGuestbook from '@shared/lib/images/nav-guestbook.png';
import iconHome from '@shared/lib/images/nav-home.png';
import iconMap from '@shared/lib/images/nav-map.png';
import iconMypage from '@shared/lib/images/nav-mypage.png';

type NavMenuItem = {
  id: string;
  label: string;
  icon: typeof iconHome;
  route: string;
};

const NAV_MENU_ITEMS: NavMenuItem[] = [
  { id: 'home', label: '홈', icon: iconHome, route: '/' },
  { id: 'map', label: '지도', icon: iconMap, route: '/map' },
  { id: 'guestbook', label: '방명록', icon: iconGuestbook, route: '/travel-note' },
  { id: 'mypage', label: '마이페이지', icon: iconMypage, route: '/mypage' },
];

// 마스코트(nav-image) 탭 시 노출되는 home_Menu 모달. 배경 클릭 시 닫힘. home/map 화면 공용.
export function NavMenuModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  function handleNavigate(route: string) {
    router.push(route);
    onClose();
  }

  return (
    <div className={`fixed inset-0 z-50 bg-black/80 transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`} onClick={onClose}>
      <div className="relative mx-auto h-full max-w-90">
        <div
          className={`absolute flex items-center justify-between transition-all duration-300 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}
          style={{ left: 31, right: 31, top: 373 }}
          onClick={(e) => e.stopPropagation()}
        >
          {NAV_MENU_ITEMS.map((item) => (
            <NavMenuItemButton key={item.id} icon={item.icon} label={item.label} onClick={() => handleNavigate(item.route)} />
          ))}
        </div>
      </div>
    </div>
  );
}

function NavMenuItemButton({ icon, label, onClick }: { icon: NavMenuItem['icon']; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex flex-col items-center gap-1.75">
      <span className="relative h-13 w-13">
        <Image src={icon} alt="" aria-hidden="true" fill sizes="52px" className="object-contain" />
      </span>
      <span className="text-label-md text-cool-neutral-white font-semibold whitespace-nowrap">{label}</span>
    </button>
  );
}
