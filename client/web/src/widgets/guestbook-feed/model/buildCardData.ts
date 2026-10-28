import { getCardBackgroundColor } from './cardBackground';
import { pickAudioBars, pickNoteColorClasses } from './decorativeStyle';
import type { NormalizedGuestbook } from './normalizeGuestbook';
import type { CardType, GuestbookCardData } from './types';

function toPhotoCard(record: NormalizedGuestbook): GuestbookCardData | null {
  const imageUrl = record.contentImageUrls?.[0];
  if (!imageUrl) return null;

  return {
    type: 'photo',
    id: record.key,
    imageUrl,
    caption: record.displayLocationName,
    backgroundColor: getCardBackgroundColor(record),
  };
}

function toNoteCard(record: NormalizedGuestbook): GuestbookCardData | null {
  if (!record.contentWriting) return null;

  return {
    type: 'note',
    id: record.key,
    text: record.contentWriting,
    ...pickNoteColorClasses(record.key),
    backgroundColor: getCardBackgroundColor(record),
  };
}

function toAudioCard(record: NormalizedGuestbook): GuestbookCardData | null {
  const audioUrl = record.contentAudioUrls?.[0]; // contentAudioUrls는 첫 번째 값만 사용 (02.md 결정 6)
  if (!audioUrl) return null;

  return {
    type: 'audio',
    id: record.key,
    audioUrl,
    title: `🎵 ${record.audioTitle ?? record.displayLocationName}`,
    subtitle: record.displayLocationName,
    bars: pickAudioBars(record.key),
    backgroundColor: getCardBackgroundColor(record),
  };
}

const BUILDERS: Record<CardType, (record: NormalizedGuestbook) => GuestbookCardData | null> = {
  photo: toPhotoCard,
  note: toNoteCard,
  audio: toAudioCard,
};

export function buildCardData(record: NormalizedGuestbook, cardType: CardType): GuestbookCardData | null {
  return BUILDERS[cardType](record);
}
