import { pickTapeStyle } from '../model/decorativeStyle';
import type { AudioCardData, GuestbookCardData, NoteCardData, PhotoCardData } from '../model/types';

function PhotoCard({ id, imageUrl, caption, backgroundColor }: PhotoCardData) {
  const { tapeClass, tapeRotateDeg } = pickTapeStyle(id);

  return (
    <div className={`relative rounded-lg p-2 shadow-[0_3px_16px_rgba(0,0,0,0.12)] ${backgroundColor ? '' : 'bg-cool-neutral-white'}`} style={backgroundColor ? { backgroundColor } : undefined}>
      {/* 위쪽 가장자리에 걸쳐 붙인 마스킹테이프 — 사진을 대충 붙여놓은 느낌 */}
      <span
        className={`absolute -top-2.5 left-1/2 h-5 w-14 rounded-[2px] shadow-[0_2px_3px_rgba(0,0,0,0.2)] ${tapeClass}`}
        style={{ transform: `translateX(-50%) rotate(${tapeRotateDeg}deg)` }}
        aria-hidden="true"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageUrl} alt="" className="aspect-square w-full rounded-sm object-cover" />
      <p className="text-body-sm text-warm-neutral-900 pt-2 pb-3 text-center">{caption}</p>
    </div>
  );
}

function NoteCard({ text, dotClass, textClass, backgroundColor }: NoteCardData) {
  return (
    <div className={`relative rounded-lg p-3 pt-4 shadow-[0_3px_16px_rgba(0,0,0,0.12)] ${backgroundColor ? '' : 'bg-cool-neutral-white'}`} style={backgroundColor ? { backgroundColor } : undefined}>
      <span className={`absolute -top-1.5 left-14 h-3.5 w-3.5 rounded-full shadow-[0_2px_3px_rgba(0,0,0,0.25)] ${dotClass}`} aria-hidden="true" />
      <p className={`text-body-sm font-medium ${textClass}`}>{text}</p>
    </div>
  );
}

function AudioCard({ title, subtitle, bars, backgroundColor }: AudioCardData) {
  return (
    <div className={`flex flex-col gap-2 rounded-lg p-3.5 shadow-[0_3px_16px_rgba(0,0,0,0.12)] ${backgroundColor ? '' : 'bg-warm-neutral-900'}`} style={backgroundColor ? { backgroundColor } : undefined}>
      <div className="flex h-9 items-end gap-1" aria-hidden="true">
        {bars.map((height, index) => (
          <span key={index} className="bg-tertiary-600 w-1 flex-1 rounded-sm" style={{ height: `${height}px` }} />
        ))}
      </div>
      <p className="text-label-md text-cool-neutral-900 font-medium">{title}</p>
      <p className="text-label-sm text-cool-neutral-900/55">{subtitle}</p>
    </div>
  );
}

export function GuestbookCard({ card }: { card: GuestbookCardData }) {
  switch (card.type) {
    case 'photo':
      return <PhotoCard {...card} />;
    case 'note':
      return <NoteCard {...card} />;
    case 'audio':
      return <AudioCard {...card} />;
  }
}
