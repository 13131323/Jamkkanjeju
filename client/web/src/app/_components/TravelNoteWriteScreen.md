# TravelNoteWriteScreen 변환 메모

원본: `localfiles/00penpot/travelnote-create.html` (Penpot 보드 `TravelNote_Create`, 클래스 `.travel-note-4985dd66e306`, 360×800)

화면 내용 확인 결과, 처음 추정("장소 선택 메뉴")과 달리 Frame 352~356은 **방명록 작성 시 첨부할 콘텐츠 타입을 고르는 하단 시트 메뉴(사진/글/소리/날씨/컬러)**였다. 상단에는 사진+후기 텍스트로 구성된 미리보기 카드가 있고, 하단 바텀시트에는 그 미리보기에 무엇을 채워 넣을지 고르는 메뉴와(현재 "사진" 선택 상태로 보이는) 사진 선택 그리드가 있다. "방명록 남기기" 헤더 타이틀 + "저장" 액션 버튼이 있는 여행지 후기(방명록) 작성 화면으로 확인했다.

## 0. HTML 구조 특이사항

이 export 파일은 모든 shape(프레임/텍스트/rect/circle/path)가 **최상위 `.travel-note-4985dd66e306` 프레임 안에 정상적으로 한 번 중첩된 뒤, 동일한 마크업이 `</div>`(프레임 종료) 바로 뒤에 위치 컨텍스트 없는 flat sibling으로 통째로 한 번 더 반복**되는 패턴이었다(주석 마커 카운트로 전수 확인: 모든 `<!-- frame/text/rect/circle -->` 항목이 정확히 2회씩만 등장, 한 번은 중첩, 한 번은 flat). 두 번째 사본은 `position:absolute` 좌표 기준이 되는 부모 컨테이너 밖에 있어 브라우저에서 렌더링 시 위치가 깨지는 것을 스크린샷으로 직접 확인했다 — Penpot HTML export 자체의 아티팩트로 판단, **최상위 프레임 안에 중첩된 첫 번째 사본만 실제 콘텐츠로 채택**하고 뒤의 flat 중복 사본은 무시했다. `display:none` 처리된 숨김 레이어는 없었다.

## 1. 디자인 토큰 대체 내역

| 원본 값 | 위치 | 대체 토큰 | 비고 |
|---|---|---|---|
| `#ededed` | 사진 썸네일(Rectangle 71~74) 배경 | `cool-neutral-100` (`#efefef`) | 팔레트에 정확히 일치하는 값 없음, RGB 거리상 가장 근접 |
| `#d9d9d9` | 하단 메뉴 원형 아이콘 배경(Ellipse 26~30) | `cool-neutral-200` (`#dddddd`) | 위와 동일 사유 |
| `border-radius: 12px` | 미리보기 카드(Rectangle 69) | `rounded-lg` (`14px`) | 스케일에 12px 없음, `md(8)`보다 `lg(14)`가 더 근접 |
| `border-radius: 32px`(좌우 상단만) | 하단 툴시트(`82abc409fdbd`) | 대체하지 않고 그대로 `rounded-t-[32px]` (arbitrary) 사용 | 토큰 최대값이 `xl(16px)`이라 대체 시 바텀시트 특유의 큰 라운드가 시각적으로 완전히 무너짐 — 그림자처럼 토큰 부재 항목으로 판단해 원본 값 유지 |
| `row-gap: 31px` (Frame 358) | 메뉴 행 ↔ 사진 선택 섹션 간격 | `gap-8` (`32px`) | 4px 배수 스케일 중 가장 근접 |
| `left:39 / right여백:37` (카드 좌우 여백) | 미리보기 카드 컨테이너 | `px-9` (`36px`) | 평균 38px과 가장 근접한 4px 배수 |
| `box-shadow: 0px 14px 34px 0px #e2dedaFF` | 미리보기 카드 그림자 | 그대로 arbitrary (`shadow-[0_14px_34px_rgba(226,222,218,1)]`) | `globals.css`에 shadow 토큰 없음, 원본 값 그대로 반영(색상 자체는 `warm-neutral-100`과 일치) |
| `box-shadow: 0px -6px 34px 0px #0000001A` | 하단 툴시트 그림자 | 그대로 arbitrary (`shadow-[0_-6px_34px_rgba(0,0,0,0.1)]`) | 위와 동일 사유 |

나머지는 `globals.css` 토큰과 정확히 일치했다(예: `#77be36`→`tertiary-600`, `#82c34a`→`tertiary-500`, `#efefef`(Rectangle 70)→`cool-neutral-100`, `#aaaaaa`→`cool-neutral-400`, `#888888`→`cool-neutral-500`, `#333333`→`cool-neutral-800`, `#2a2621`→`warm-neutral-900`, `#f6f5f4`/`#e2deda` 그라디언트→`warm-neutral-50`/`warm-neutral-100`, `row-gap:20px`→`gap-5`, `row-gap:12px`→`gap-3`, `row-gap:8px`→`gap-2`, `row-gap:30px`→`gap-7.5`, `52px` 원형 아이콘 크기→`h-13 w-13`).

## 2. 공용 컴포넌트 재사용/미재사용

- 변환 시점 기준 `web/src/shared/` 아래 `ui/` 디렉터리가 존재하지 않아(가이드 예외 조건) 전부 raw markup(div/button + Tailwind)으로 구현.

## 3. 기타 임의 판단 사항

- **상태바(9:41, 신호/와이파이/배터리), Header-Zone의 `status-bar` 프레임 전체 제거**: OS 셸 UI, 가이드 규칙에 따라 항상 제거.
- **`Header-Zone`의 `column-reverse` 정규화**: DOM 순서는 `[Header, status-bar]`였고 `column-reverse`로 실제로는 status-bar가 위, Header가 아래로 보임. status-bar를 통째로 제거했으므로 남은 Header만 정순으로 배치.
- **Header 내부 절대좌표 → flex 3분할 승격**: `back-click`(left16), 타이틀(left131, 대략 중앙), `저장` 칩(left297, 우측)이 각각 절대좌표였던 것을 `justify-between` + 타이틀 `absolute left-1/2 -translate-x-1/2`로 중앙 고정하는 일반적인 "뒤로가기/중앙 타이틀/우측 액션" 헤더 패턴으로 재구성.
- **`저장` 버튼 폰트 크기(13px) 토큰 매핑**: `text-label-sm`(12px)과 `text-label-md`(14px) 중간값이라 애매했으나, 버튼류 짧은 라벨이라는 용도상 `text-label-sm`을 채택.
- **바텀시트(`82abc409fdbd`)의 `padding-inline: 166px` / `padding-block-end: 322px`는 무시**: Penpot의 `column-reverse` + `align-items:center` + auto-height 조합에서 나온 것으로 보이는 비정상적으로 큰 padding 값(좌우 166px씩이면 콘텐츠 폭이 28px밖에 남지 않아 내부 실제 콘텐츠 폭과 모순)이라 export 아티팩트로 판단하고 무시. 대신 실제로 유효해 보였던 `padding-block-start: 16px`만 `pt-4`로 반영했고, 나머지는 일반적인 바텀시트 패딩(`pb-6`, 좌우 `px-6` — `ToolMenu`/`PhotoPicker` 내부에 적용)으로 임의 설정.
- **Frame 358 / `0222ec2a3191`(글) / `menu`의 `column-reverse`, Frame 357 / `menu`의 `row-reverse` 전부 정규화**: DOM 순서를 실제 시각 순서(핸들 바 → 메뉴 아이콘 행(사진/글/소리/날씨/컬러) → "찍어둔 사진 고르기" 라벨 → 사진 썸네일 4개, 각 메뉴 아이템 내부는 원형 아이콘 위 + 라벨 아래)로 재배치하고 `flex-row`/`flex-col` 정순만 사용.
- **바텀시트 상단 "핸들 바"(`Vector 31`, 28×4 rounded bar) 재현**: 원본은 둥근 사각형을 그리는 SVG path였으나 단순 장식 요소라 `div` + Tailwind(`h-1 w-7 rounded-full`)로 대체.
- **사진 썸네일 4개 중 첫 번째(Rectangle 71)만 `2px solid tertiary-500` 테두리**: 원본 그대로 "선택됨" 상태로 표현(`mock.photoThumbnails[0].selected = true`).
- **회색 사각형/원형 플레이스홀더**(사진 미리보기 박스, 썸네일 4개, 메뉴 원형 아이콘 5개): 전부 실제 이미지/아이콘 에셋이 아니므로 `div`/`button` + Tailwind 배경색 유지, `// TODO: 실제 이미지/에셋 교체` 주석 처리.
- **"여기에 후기를 작성할 수 있어요." → `<textarea>` 승격**: 미리보기 카드 안에서 후기 내용이 들어갈 자리로 판단, 가이드의 "방명록 내용 textarea" 예시와 일치. `placeholder`만 표시하고 `useState`/`onChange` 등 상태 관리는 붙이지 않음(정적 UI).
- **뒤로가기 버튼 / 사진 썸네일 4개 → `<button type="button">` 승격**: 클릭 의도가 명확한 요소들. `onClick` 로직은 미구현.
- **아이콘 추출**: 뒤로가기 화살표(chevron-left)는 1회성이라 `IconChevronLeft` 함수로 분리했지만 인라인 사용해도 무방한 수준 — 가독성을 위해 별도 함수로 뺌. 그 외 반복 사용 아이콘은 없음(하단 메뉴 원형/사진 썸네일은 아이콘이 아니라 이미지 플레이스홀더).
- **레이아웃 앵커링**: 원본은 헤더~카드~바텀시트가 800px 고정 캔버스 내 절대좌표였음. 문서 흐름 전환 시, 헤더/바텀시트 사이 공간에 카드가 위쪽 여백(35px)과 아래쪽 여백(49px)으로 거의 대칭적으로 떠 있던 것을 참고해 `flex-1 justify-center`로 카드를 헤더-바텀시트 사이 공간에서 수직 중앙 배치하는 방식으로 근사했다.
- **파일명**: 보드명 `TravelNote_Create`가 이미 존재하는 `TravelSaveCompleteScreen`(저장 완료 화면)과 혼동되지 않도록, "작성" 단계임을 명확히 드러내는 `TravelNoteWriteScreen`으로 명명.

## 4. 체크리스트 확인

- [x] html/head/body, 폰트 link, 상태바, 화면 자체 하단 탭 없음
- [x] 고정 캔버스 프레임 폭/높이 없음 (`min-h-screen` + `w-full`)
- [x] `src/shared/ui/` 부재 확인, raw markup 사용
- [x] 전부 Tailwind + `globals.css` 토큰 우선 반영, 대체 내역 위 1번 표에 기록
- [x] 반복 텍스트/수치(`toolMenu`, `photoThumbnails`) `mock` 객체로 추출
- [x] 클릭 가능 요소 `<button>`으로 승격
- [x] `"use client"` 불필요(상태/이벤트 없음) → 미부착
- [x] 미사용 import 없음
