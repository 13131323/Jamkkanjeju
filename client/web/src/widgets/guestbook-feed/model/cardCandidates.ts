import type { NormalizedGuestbook } from './normalizeGuestbook';
import type { CardType } from './types';

// 이 레코드가 "어떤 카드가 될 수 있는지"만 계산한다 — 다양성 배분은 assignCardTypes.ts 담당.
export function getCardCandidates(record: NormalizedGuestbook): CardType[] {
  const candidates: CardType[] = [];

  if (record.contentImageUrls && record.contentImageUrls.length > 0) {
    candidates.push('photo');
  }
  if (record.contentWriting) {
    candidates.push('note');
  }
  if (record.contentAudioUrls && record.contentAudioUrls.length > 0) {
    candidates.push('audio');
  }

  // 날씨만 저장된 기록도 기존 메모 카드로 표시한다.
  if (candidates.length === 0 && record.contentWeather?.trim()) candidates.push('note');
  return candidates;
}
