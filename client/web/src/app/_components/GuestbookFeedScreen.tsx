const mock = {
  title: "방명록",
  subtitle: "여행자들이 남긴 흔적을 발견하세요",
  filters: [
    { label: "전체", active: true },
    { label: "성산일출봉", active: false },
    { label: "광치기해변", active: false },
    { label: "섭지코지", active: false },
  ],
  tabs: [
    { label: "전체", active: true },
    { label: "🎨 컬러", active: false },
    { label: "🎵 음악", active: false },
    { label: "🌤 날씨", active: false },
    { label: "📷 사진", active: false },
  ],
  sortLabel: "최신순",
};

type PhotoCardData = { type: "photo"; caption: string; rotateClass: string };
type NoteCardData = {
  type: "note";
  text: string;
  dotClass: string;
  textClass: string;
  rotateClass: string;
};
type ColorCardData = {
  type: "color";
  label: string;
  swatchClasses: string[];
  fromClass: string;
  toClass: string;
  rotateClass: string;
};
type PostcardCardData = {
  type: "postcard";
  emoji: string;
  quote: string;
  label: string;
  rotateClass: string;
};
type AudioCardData = {
  type: "audio";
  meta: string;
  title: string;
  bars: number[];
  rotateClass: string;
};
type WeatherCardData = {
  type: "weather";
  place: string;
  temp: string;
  emoji: string;
  rotateClass: string;
};

type GuestbookCardData =
  | PhotoCardData
  | NoteCardData
  | ColorCardData
  | PostcardCardData
  | AudioCardData
  | WeatherCardData;

const cards: GuestbookCardData[] = [
  { type: "photo", caption: "섭지코지, 바람 많던 날", rotateClass: "rotate-[4deg]" },
  {
    type: "weather",
    place: "섭지코지 · 맑음",
    temp: "21°C",
    emoji: "🌤",
    rotateClass: "rotate-[3deg]",
  },
  {
    type: "note",
    text: "오늘 광치기해변 파도소리 진짜 좋았다 🌊 다음엔 노을 볼 때 다시 와야지",
    dotClass: "bg-tertiary-600",
    textClass: "text-tertiary-800",
    rotateClass: "-rotate-[6deg]",
  },
  {
    type: "postcard",
    emoji: "🌅",
    quote: "\"해가 뜨는 순간, 오늘의 시작을 응원해요.\"",
    label: "AI 엽서 · 성산일출봉",
    rotateClass: "rotate-[2deg]",
  },
  {
    type: "color",
    label: "성산일출봉 새벽 컬러",
    swatchClasses: ["bg-primary-900", "bg-primary-700", "bg-primary-100"],
    fromClass: "from-primary-300",
    toClass: "to-primary-700",
    rotateClass: "-rotate-[3deg]",
  },
  {
    type: "audio",
    meta: "0:18 · AI 분석: 파도, 바람",
    title: "▶ 파도 소리 · 광치기",
    bars: [14, 24, 34, 19, 27, 12, 20],
    rotateClass: "-rotate-[2deg]",
  },
  { type: "photo", caption: "광치기 앞 카페, 당근케이크", rotateClass: "-rotate-[5deg]" },
  {
    type: "note",
    text: "섭지코지 소품샵에서 산 조개 팔찌, 여기서만 파는 거래요 🐚",
    dotClass: "bg-primary-800",
    textClass: "text-warm-neutral-900",
    rotateClass: "rotate-[5deg]",
  },
  {
    type: "color",
    label: "일몰의 오렌지빛",
    swatchClasses: ["bg-tertiary-800", "bg-sunny-yellow-500", "bg-tertiary-200"],
    fromClass: "from-sunny-yellow-200",
    toClass: "to-sunny-yellow-500",
    rotateClass: "rotate-[4deg]",
  },
  {
    type: "note",
    text: "섭지코지 등대까지 걷는 산책길, 바람이 세니까 겉옷 챙기세요!",
    dotClass: "bg-warm-neutral-400",
    textClass: "text-warm-neutral-800",
    rotateClass: "-rotate-[4deg]",
  },
  {
    type: "postcard",
    emoji: "💌",
    quote: "\"파도처럼 왔다 가는 오늘도, 좋은 하루였길.\"",
    label: "AI 엽서 · 광치기해변",
    rotateClass: "-rotate-[3deg]",
  },
];

function GuestbookHeader() {
  return (
    <div className="flex w-full flex-col gap-1 px-4 pb-3.5 pt-4">
      <h1 className="text-heading-h3 font-semibold text-warm-neutral-900">{mock.title}</h1>
      <p className="text-body-md text-warm-neutral-600">{mock.subtitle}</p>
    </div>
  );
}

function FilterChips() {
  return (
    <div className="flex w-full gap-2 overflow-x-auto px-4 pb-2">
      {mock.filters.map((filter) => (
        <button
          key={filter.label}
          type="button"
          className={`shrink-0 rounded-full border px-4 py-1.5 text-label-md font-medium ${
            filter.active
              ? "border-warm-neutral-900 bg-warm-neutral-900 text-cool-neutral-white"
              : "border-cool-neutral-200 bg-cool-neutral-white text-warm-neutral-800"
          }`}
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
}

function CategoryTabs() {
  return (
    <div className="flex w-full gap-6 overflow-x-auto border-b border-cool-neutral-100 px-4">
      {mock.tabs.map((tab) => (
        <button
          key={tab.label}
          type="button"
          className={`shrink-0 border-b-2 py-2.5 text-label-md ${
            tab.active
              ? "border-cool-neutral-900 font-semibold text-warm-neutral-900"
              : "border-transparent font-normal text-warm-neutral-600"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function SortBar() {
  return (
    <div className="flex w-full items-center justify-end gap-1 px-4 py-2">
      <span className="text-label-sm text-warm-neutral-600">{mock.sortLabel}</span>
      <svg
        className="h-[5px] w-2"
        viewBox="0 0 8 5"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M1 1L4 4L7 1"
          stroke="#6a6a6a"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function PhotoCard({ caption, rotateClass }: PhotoCardData) {
  return (
    <div
      className={`mb-3 w-full break-inside-avoid rounded-lg bg-cool-neutral-white p-2 shadow-[0_3px_16px_rgba(0,0,0,0.12)] ${rotateClass}`}
    >
      {/* TODO: 실제 이미지/에셋 교체 */}
      <div className="aspect-square w-full rounded-sm bg-cool-neutral-200" />
      <p className="pb-3 pt-2 text-center text-body-sm text-warm-neutral-900">{caption}</p>
    </div>
  );
}

function NoteCard({ text, dotClass, textClass, rotateClass }: NoteCardData) {
  return (
    <div
      className={`relative mb-3 w-full break-inside-avoid rounded-lg bg-cool-neutral-white p-3 pt-4 shadow-[0_3px_16px_rgba(0,0,0,0.12)] ${rotateClass}`}
    >
      <span
        className={`absolute -top-1.5 left-14 h-3.5 w-3.5 rounded-full shadow-[0_2px_3px_rgba(0,0,0,0.25)] ${dotClass}`}
        aria-hidden="true"
      />
      <p className={`text-body-sm font-medium ${textClass}`}>{text}</p>
    </div>
  );
}

function ColorCard({ label, swatchClasses, fromClass, toClass, rotateClass }: ColorCardData) {
  return (
    <div
      className={`mb-3 flex min-h-[130px] w-full break-inside-avoid flex-col justify-end gap-2 rounded-lg bg-gradient-to-b ${fromClass} ${toClass} p-3 shadow-[0_3px_16px_rgba(0,0,0,0.12)] ${rotateClass}`}
    >
      <div className="flex gap-1">
        {swatchClasses.map((swatchClass, index) => (
          <span key={index} className={`h-3.5 w-3.5 rounded-sm ${swatchClass}`} aria-hidden="true" />
        ))}
      </div>
      <p className="text-label-sm font-bold text-cool-neutral-white">{label}</p>
    </div>
  );
}

function PostcardCard({ emoji, quote, label, rotateClass }: PostcardCardData) {
  return (
    <div
      className={`relative mb-3 w-full break-inside-avoid rounded-lg border border-warm-neutral-200 bg-tertiary-50 p-3 pr-10 shadow-[0_3px_16px_rgba(0,0,0,0.12)] ${rotateClass}`}
    >
      <span
        className="absolute right-2 top-2 flex h-9 w-[30px] items-center justify-center border-2 border-dashed border-warm-neutral-400 text-body-md"
        aria-hidden="true"
      >
        {emoji}
      </span>
      <p className="text-label-sm font-bold text-warm-neutral-700">{label}</p>
      <p className="mt-1.5 text-body-sm text-warm-neutral-700">{quote}</p>
    </div>
  );
}

function AudioCard({ meta, title, bars, rotateClass }: AudioCardData) {
  return (
    <div
      className={`mb-3 flex w-full flex-col gap-2 break-inside-avoid rounded-lg bg-warm-neutral-900 p-3.5 shadow-[0_3px_16px_rgba(0,0,0,0.12)] ${rotateClass}`}
    >
      <div className="flex h-9 items-end gap-1" aria-hidden="true">
        {bars.map((height, index) => (
          <span
            key={index}
            className="w-1 flex-1 rounded-sm bg-tertiary-600"
            style={{ height: `${height}px` }}
          />
        ))}
      </div>
      <p className="text-label-md font-medium text-cool-neutral-white">{title}</p>
      <p className="text-label-sm text-cool-neutral-white/55">{meta}</p>
    </div>
  );
}

function WeatherCard({ place, temp, emoji, rotateClass }: WeatherCardData) {
  return (
    <div
      className={`mb-3 flex w-full min-h-[130px] break-inside-avoid flex-col gap-1 rounded-lg bg-gradient-to-b from-primary-100 to-primary-300 p-3 shadow-[0_3px_16px_rgba(0,0,0,0.12)] ${rotateClass}`}
    >
      <span className="text-heading-h3" aria-hidden="true">
        {emoji}
      </span>
      <p className="text-heading-h4 font-semibold text-cool-neutral-white">{temp}</p>
      <p className="text-label-sm text-cool-neutral-white">{place}</p>
    </div>
  );
}

function GuestbookCard({ card }: { card: GuestbookCardData }) {
  switch (card.type) {
    case "photo":
      return <PhotoCard {...card} />;
    case "note":
      return <NoteCard {...card} />;
    case "color":
      return <ColorCard {...card} />;
    case "postcard":
      return <PostcardCard {...card} />;
    case "audio":
      return <AudioCard {...card} />;
    case "weather":
      return <WeatherCard {...card} />;
  }
}

function GuestbookFeed() {
  return (
    <div className="w-full columns-2 gap-3 px-4 pb-8 pt-3">
      {cards.map((card, index) => (
        <GuestbookCard key={index} card={card} />
      ))}
    </div>
  );
}

export default function GuestbookFeedScreen() {
  return (
    <div className="flex w-full flex-col bg-cool-neutral-white">
      <GuestbookHeader />
      <FilterChips />
      <CategoryTabs />
      <SortBar />
      <GuestbookFeed />
    </div>
  );
}
