export type CardType = 'photo' | 'note' | 'audio';

export type PhotoCardData = {
  type: 'photo';
  id: string;
  imageUrl: string;
  caption: string;
  backgroundColor?: string;
};

export type NoteCardData = {
  type: 'note';
  id: string;
  text: string;
  dotClass: string;
  textClass: string;
  backgroundColor?: string;
};

export type AudioCardData = {
  type: 'audio';
  id: string;
  audioUrl: string;
  title: string;
  subtitle: string;
  bars: number[];
  backgroundColor?: string;
};

export type GuestbookCardData = PhotoCardData | NoteCardData | AudioCardData;
