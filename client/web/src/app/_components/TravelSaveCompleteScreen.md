# TravelSaveCompleteScreen 변환 메모

원본: `localfiles/00penpot/travelnote-save-complete.html` (Penpot 보드 `travelnote-save-complete`, id `01a00941-3984-7558-9f44-592f117c5b0c`)

> 참고: 같은 이름 계열로 `travelnote-save-complete-2` 보드도 존재. 이번 변환은 사용자가 확인한 대로 **정확히 이름이 일치하는 `travelnote-save-complete`** 기준.

## 1. 디자인 토큰 대체 내역

대부분의 색상/폰트 크기는 `globals.css` 토큰과 정확히 일치했다. 정확히 일치하지 않아 대체한 항목만 정리:

| 원본 값 | 위치 | 대체 토큰 | 비고 |
|---|---|---|---|
| `#6db959` | SearchSelectField(장소 검색 버튼) 내 지도 핀 아이콘 | `tertiary-500` (`#82c34a`) | 팔레트에 정확히 일치하는 초록이 없어 가장 가까운 tertiary 톤 사용 |
| `border: 1px solid #e8e6e3` / `#e2deda` | 장소/날짜 입력 버튼 테두리 | `warm-neutral-100` (`#e2deda`) | 두 원본 테두리 색이 거의 동일해 하나의 토큰으로 통일 |
| `border-radius: 12px` | 장소/날짜 입력 버튼, 카드 내부 요소 | `rounded-lg` (`14px`) | 라디우스 스케일에 12px이 없어 `md(8)`보다 `lg(14)`가 더 근접 |
| `#ffd15b` (컨페티) | 성공 일러스트 컨페티 조각 | `sunny-yellow-300` (`#f8dc4c`) | RGB 거리상 가장 근접 |
| `#5c9bff` (컨페티) | 성공 일러스트 컨페티 조각 | `primary-400` (`#4dc9f2`) | 파란 계열 중 가장 근접 |
| `#ff6b6b` (컨페티) | 성공 일러스트 컨페티 조각 | `warm-neutral-400` (`#a89b8d`) | ⚠️ 팔레트에 red 계열이 전혀 없어 근사치가 매우 부정확함. 축하 컨페티 색감이 원본과 다르게 보일 수 있음 — 필요 시 accent/red 토큰 추가를 검토해 주세요. |
| `border-radius: 1~2px` (컨페티 사각형들) | 성공 일러스트 컨페티 조각 | `rounded-sm` (`4px`) | 스케일 내 가장 작은 라디우스 |
| `box-shadow: 0px 12px 24px 0px #0000000F` | 프리뷰 카드 그림자 | 그대로 arbitrary value 사용 (`shadow-[0_12px_24px_rgba(0,0,0,0.06)]`) | `globals.css`에 shadow 토큰이 정의되어 있지 않아 원본 값을 그대로 반영 |

## 2. 공용 컴포넌트 재사용/미재사용

- 변환 시점 기준 `src/shared/ui/`가 비어 있어(가이드 1번 규칙의 예외 조건) 전부 raw markup(div/button + Tailwind)으로 구현.

## 3. 기타 임의 판단 사항

- **상태바(9:41, 신호/와이파이/배터리) 전부 제거**: 가이드 2-a 규칙(항상 제거)에 따름.
- **"방명록 작성" 버튼 미포함**: 원본 Penpot 디자인에서 해당 버튼(`.button-6a8e6dad13db`)이 `display: none`으로 처리되어 있어(방명록 작성 완료 후 진입하는 화면이라 추정), 렌더링하지 않음. 필요 시 두 번째 CTA로 복원 가능.
- **Flex `column-reverse` / `row-reverse` 저작 트릭 → 일반 순서로 정규화**: Penpot에서 하단부터 쌓아 올리는 방식으로 만들어진 레이아웃이라 실제 DOM 순서가 시각 순서와 반대인 구간이 많았음(예: 성공 메시지 카드가 DOM상 나중에 오지만 화면엔 위쪽에 표시). 변환 시 실제 화면에 보이는 최종 시각 순서 그대로 JSX 자식 순서를 재배치하고 `flex-row`/`flex-col`(정순)만 사용 — 가이드 3번 규칙("절대좌표/저작 트릭 → 문서 흐름")의 취지에 맞춤.
- **Button/DestModal 등 순수 레이아웃 래퍼 프레임 축약**: 원본엔 `Button > DestModal > Button` 같은 구조용 래퍼가 많았으나(숨김 버튼과 나란히 배치하기 위한 프레임), 보이는 버튼이 하나뿐이라 `BottomActions`에서 단순 `<button>` 하나로 축약.
- **지도 핀 아이콘 공용화**: 장소 미리보기 카드의 위치 태그, 장소 검색 버튼에서 동일한 지도 핀 아이콘이 2회 재사용되어 `IconMapPin` 로컬 컴포넌트로 추출(`fill`을 prop으로 분리). 캘린더/체크마크 아이콘은 1회성이라 인라인 유지.
- **`select-input`(날짜), `SearchSelectField`(장소) → `<button type="button">` 승격**: 탭하면 날짜피커/장소검색이 열리는 트리거로 보여 가이드 8번 규칙에 따라 버튼으로 승격. `onClick` 로직은 미구현(정적 UI 단계).
- **사진 썸네일**: 원본에 실제 이미지 URL이 있었으나 실제 에셋이 아니므로 회색 플레이스홀더 처리(가이드 5번 규칙), `// TODO: 실제 이미지/에셋 교체` 주석 남김.
- **목데이터**: 미리보기 카드의 날짜/날씨/설명/장소명을 상단 `mock` 객체로 추출.
- **파일명**: 보드명 `travelnote-save-complete`을 화면 내용(여행 기록 저장 완료 화면)이 드러나도록 `TravelSaveCompleteScreen`으로 명명.

## 4. 체크리스트 확인

- [x] html/head/body, 상태바, 화면 자체 하단 탭 없음
- [x] 고정 캔버스 프레임 폭 없음 (`w-full` + `min-h-screen`)
- [x] `src/shared/ui/` 비어 있어 raw markup 사용 (근거 위 2번 항목)
- [x] 전부 Tailwind + `globals.css` 토큰 우선 반영, 대체 내역 위 1번 표에 기록
- [x] 반복 텍스트/수치 `mock` 객체로 추출
- [x] 클릭 가능 요소 `<button>`으로 승격
- [x] `"use client"` 불필요 (상태/이벤트 없음) → 미부착
- [x] 미사용 import 없음
