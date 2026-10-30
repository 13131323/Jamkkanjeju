'use client';

/** 전체 개수 대신 hasNext로 확인한 페이지 번호와 이전·다음 이동을 제공한다. */
export function GuestbookPagination({ page, maxKnownPage, hasNextPage, pending, onChange }: {
  page: number; maxKnownPage: number; hasNextPage: boolean; pending: boolean; onChange: (page: number) => void;
}) {
  const start = Math.max(0, Math.min(page - 2, maxKnownPage - 4));
  const numbers = Array.from({ length: Math.min(5, maxKnownPage + 1) }, (_, index) => start + index);
  return (
    <nav aria-label="방명록 페이지" className="flex items-center justify-center gap-1 px-4 pt-4" style={{ paddingBottom: 'calc(112px + var(--safe-area-bottom))' }}>
      <button type="button" aria-label="이전 페이지" disabled={pending || page === 0} onClick={() => onChange(page - 1)} className="text-label-sm text-cool-neutral-white rounded-full px-3 py-2 disabled:opacity-30">이전</button>
      {numbers.map((number) => (
        <button key={number} type="button" aria-label={`${number + 1}페이지`} aria-current={number === page ? 'page' : undefined}
          disabled={pending} onClick={() => onChange(number)}
          className={`text-label-md flex h-9 min-w-9 items-center justify-center rounded-full font-semibold disabled:opacity-50 ${number === page ? 'bg-cool-neutral-white text-warm-neutral-900' : 'text-cool-neutral-white hover:bg-white/10'}`}>
          {number + 1}
        </button>
      ))}
      <button type="button" aria-label="다음 페이지" disabled={pending || (!hasNextPage && page >= maxKnownPage)} onClick={() => onChange(page + 1)} className="text-label-sm text-cool-neutral-white rounded-full px-3 py-2 disabled:opacity-30">다음</button>
    </nav>
  );
}
