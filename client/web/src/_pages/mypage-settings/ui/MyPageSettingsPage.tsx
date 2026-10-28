'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { WithdrawConfirmModal } from '@features/account-withdraw';
import { InquiryModal } from '@features/inquiry';

type SettingsItem = {
  id: string;
  label: string;
  value?: string;
  showChevron?: boolean;
  danger?: boolean;
};

type SettingsSection = {
  id: string;
  title: string;
  items: SettingsItem[];
};

const mock = {
  title: '설정',
  sections: [
    {
      id: 'etc',
      title: '기타',
      items: [
        { id: 'contact', label: '문의하기' },
        { id: 'terms', label: '이용약관' },
        { id: 'privacy', label: '개인정보처리방침' },
        { id: 'withdraw', label: '회원탈퇴', danger: true },
      ],
    },
  ] satisfies SettingsSection[],
};

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div
      className="border-cool-neutral-100 flex w-full shrink-0 items-center gap-3 border-b px-4"
      style={{ height: `calc(56px + var(--safe-area-top))`, paddingTop: `var(--safe-area-top)` }}
    >
      <button type="button" aria-label="뒤로가기" onClick={onBack} className="bg-cool-neutral-100 flex h-9 w-9 items-center justify-center rounded-full">
        <ChevronLeftIcon />
      </button>
      <span className="text-heading-h3 text-warm-neutral-900 font-bold">{title}</span>
    </div>
  );
}

function SectionTitle({ title, isFirst }: { title: string; isFirst: boolean }) {
  return <p className={`text-label-md text-warm-neutral-400 px-5 pb-2 font-medium ${isFirst ? 'pt-6' : 'pt-8'}`}>{title}</p>;
}

const ITEM_ROUTES: Partial<Record<SettingsItem['id'], string>> = {
  terms: '/policies/terms-of-service',
  privacy: '/policies/privacy',
};

function SettingsRow({ item, isLast, onClick }: { item: SettingsItem; isLast: boolean; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`flex w-full items-center justify-between px-5 py-4 text-left ${isLast ? '' : 'border-cool-neutral-100 border-b'}`}>
      <span className={`text-body-lg font-normal ${item.danger ? 'text-[#ff3030]' : 'text-warm-neutral-900'}`}>{item.label}</span>
      {(item.value || item.showChevron) && (
        <span className="flex items-center gap-1.5">
          {item.value && <span className="text-body-lg text-warm-neutral-400">{item.value}</span>}
          {item.showChevron && <ChevronRightIcon />}
        </span>
      )}
    </button>
  );
}

function SettingsSectionView({ section, isFirst, onItemClick }: { section: SettingsSection; isFirst: boolean; onItemClick: (item: SettingsItem) => void }) {
  return (
    <section>
      <SectionTitle title={section.title} isFirst={isFirst} />
      <div className="flex flex-col">
        {section.items.map((item, index) => (
          <SettingsRow key={item.id} item={item} isLast={index === section.items.length - 1} onClick={() => onItemClick(item)} />
        ))}
      </div>
    </section>
  );
}

export function MyPageSettingsPage() {
  const router = useRouter();
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [isInquiryOpen, setIsInquiryOpen] = useState(false);

  function handleItemClick(item: SettingsItem) {
    if (item.id === 'withdraw') {
      setIsWithdrawOpen(true);
      return;
    }
    if (item.id === 'contact') {
      setIsInquiryOpen(true);
      return;
    }
    const route = ITEM_ROUTES[item.id];
    if (route) router.push(route);
  }

  return (
    <div className="bg-cool-neutral-white min-h-dvh w-full">
      <Header title={mock.title} onBack={() => router.back()} />
      <div className="flex flex-col">
        {mock.sections.map((section, index) => (
          <SettingsSectionView key={section.id} section={section} isFirst={index === 0} onItemClick={handleItemClick} />
        ))}
      </div>

      {isWithdrawOpen && <WithdrawConfirmModal onClose={() => setIsWithdrawOpen(false)} />}
      {isInquiryOpen && <InquiryModal onClose={() => setIsInquiryOpen(false)} />}
    </div>
  );
}

function ChevronLeftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M12.5 5l-5 5 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-warm-neutral-900" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="6" height="10" viewBox="0 0 5 9" fill="none" aria-hidden="true">
      <path d="M1 1L4 4.5L1 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="text-cool-neutral-400" />
    </svg>
  );
}
