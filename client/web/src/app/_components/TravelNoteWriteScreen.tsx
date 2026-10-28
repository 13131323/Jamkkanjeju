const mock = {
  title: "방명록 남기기",
  contentPlaceholder: "여기에 후기를 작성할 수 있어요.",
  photoPickerLabel: "찍어둔 사진 고르기",
  toolMenu: [
    { label: "사진" },
    { label: "글" },
    { label: "소리" },
    { label: "날씨" },
    { label: "컬러" },
  ],
  photoThumbnails: [
    { id: 1, selected: true },
    { id: 2, selected: false },
    { id: 3, selected: false },
    { id: 4, selected: false },
  ],
};

function IconChevronLeft() {
  return (
    <svg
      className="h-2.5 w-1.5"
      viewBox="6780.5 3015 5 10"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M6784.79296875,3025.70703125C6785.18359375,3026.09765625,6785.81640625,3026.09765625,6786.20703125,3025.70703125C6786.59765625,3025.316650390625,6786.59765625,3024.683349609375,6786.20703125,3024.29296875L6785.5,3025L6784.79296875,3025.70703125ZM6780.5,3020L6779.79296875,3019.29296875L6779.0859375,3020L6779.79296875,3020.70703125L6780.5,3020ZM6786.20703125,3015.70703125C6786.59765625,3015.316650390625,6786.59765625,3014.683349609375,6786.20703125,3014.29296875C6785.81640625,3013.90234375,6785.18359375,3013.90234375,6784.79296875,3014.29296875L6785.5,3015L6786.20703125,3015.70703125ZM6785.5,3025L6786.20703125,3024.29296875L6781.20703125,3019.29296875L6780.5,3020L6779.79296875,3020.70703125L6784.79296875,3025.70703125L6785.5,3025ZM6780.5,3020L6781.20703125,3020.70703125L6786.20703125,3015.70703125L6785.5,3015L6784.79296875,3014.29296875L6779.79296875,3019.29296875L6780.5,3020Z"
        fill="#2a2621"
        fillRule="nonzero"
      />
    </svg>
  );
}

function Header() {
  return (
    <div className="relative flex h-14 w-full shrink-0 items-center justify-between px-4">
      <button
        type="button"
        aria-label="뒤로가기"
        className="flex items-center justify-center rounded-full p-1"
      >
        <IconChevronLeft />
      </button>
      <span className="text-heading-h4 absolute left-1/2 -translate-x-1/2 font-bold text-warm-neutral-900">
        {mock.title}
      </span>
      <button
        type="button"
        className="text-label-sm rounded-full bg-tertiary-600 px-3 py-2 font-semibold text-cool-neutral-white"
      >
        저장
      </button>
    </div>
  );
}

function PreviewCard() {
  return (
    <div className="w-full px-9">
      <div className="flex w-full flex-col gap-2.5 rounded-lg bg-cool-neutral-white p-4 shadow-[0_14px_34px_rgba(226,222,218,1)]">
        {/* TODO: 실제 이미지/에셋 교체 */}
        <div className="h-[170px] w-full rounded-md bg-cool-neutral-100" />
        <textarea
          placeholder={mock.contentPlaceholder}
          className="text-body-md w-full resize-none border-0 p-0 text-cool-neutral-400 outline-none placeholder:text-cool-neutral-400"
          rows={1}
        />
      </div>
    </div>
  );
}

function ToolMenu() {
  return (
    <div className="flex w-full items-center justify-center gap-5 px-6">
      {mock.toolMenu.map((item) => (
        <button
          key={item.label}
          type="button"
          className="flex flex-col items-center gap-2"
        >
          {/* TODO: 실제 이미지/에셋 교체 */}
          <div className="h-13 w-13 shrink-0 rounded-full bg-cool-neutral-200" />
          <span className="text-body-sm text-cool-neutral-500">{item.label}</span>
        </button>
      ))}
    </div>
  );
}

function PhotoPicker() {
  return (
    <div className="flex w-full flex-col gap-3 px-6">
      <p className="text-label-md font-semibold text-cool-neutral-800">
        {mock.photoPickerLabel}
      </p>
      <div className="flex w-full items-center gap-2">
        {mock.photoThumbnails.map((photo) => (
          <button
            key={photo.id}
            type="button"
            aria-label="사진 선택"
            className={
              "h-[74px] w-[74px] shrink-0 rounded-md bg-cool-neutral-100" +
              (photo.selected ? " border-2 border-tertiary-500" : "")
            }
          >
            {/* TODO: 실제 이미지/에셋 교체 */}
          </button>
        ))}
      </div>
    </div>
  );
}

function BottomToolSheet() {
  return (
    <div className="flex w-full flex-col items-center gap-7.5 rounded-t-[32px] bg-cool-neutral-white pb-6 pt-4 shadow-[0_-6px_34px_rgba(0,0,0,0.1)]">
      <div aria-hidden="true" className="h-1 w-7 rounded-full bg-cool-neutral-200" />
      <ToolMenu />
      <PhotoPicker />
    </div>
  );
}

export default function TravelNoteWriteScreen() {
  return (
    <div className="flex min-h-screen w-full flex-col bg-gradient-to-b from-warm-neutral-50 to-warm-neutral-100">
      <Header />
      <div className="flex flex-1 flex-col justify-center">
        <PreviewCard />
      </div>
      <BottomToolSheet />
    </div>
  );
}
