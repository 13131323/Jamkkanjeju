import { wasApiErrorNotified } from '@packages/shared';
import * as Sentry from '@sentry/react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Linking from 'expo-linking';
import * as MediaLibrary from 'expo-media-library';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Alert, Image, PixelRatio, Platform, Pressable, Text, View } from 'react-native';
import type { ImageSourcePropType, LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureRef, releaseCapture } from 'react-native-view-shot';
import { Button } from '@/components/Button/Button';
import { SkeletonBlock } from '@/components/SkeletonBlock/SkeletonBlock';
import { useToast } from '@/components/Toast/Toast';
import { ctaBottomPadding, MIN_BOTTOM_INSET } from '@/styles/safeArea';
import { joinWithParticle } from '@/utils/koreanParticle';
import { resolvePermissionGuidance } from '@/utils/permissionGuidance';
import { resolveCharacterSource } from './characterSource';
import type { PhotoCaptureCharacter } from './characterSource';
import { resolveCompositeCaptureScale } from './compositeCaptureScale';
import { schedulePendingNotice } from './pendingNotice';
import { CAPTURE_ACCENTS, characterPhotoCaptureStyles as styles, compositeCharacterStyle } from './styles';
import type { PhotoCaptureAccent } from './styles';
import { resolveUploadCaptureSize } from './uploadCaptureSize';
import { withTimeout } from './withTimeout';

/** 오프스크린 합성 이미지(배경 사진 + 캐릭터)의 onLoad를 기다리는 최대 시간. withTimeout.ts 주석 참고 */
const IMAGE_LOAD_TIMEOUT_MS = 8000;

/** 합성 사진의 JPEG 품질. 갤러리 저장본과 업로드본이 같은 값을 쓴다 */
const COMPOSITE_JPEG_QUALITY = 0.92;

/**
 * 촬영이 길어질 때만 뜨는 안내.
 *
 * 셔터를 누르면 화면은 카메라 그대로인 채 촬영 → 합성 → 캡처가 이어져서, 느린 기기에서는
 * "눌렸는지" 자체가 안 보인다(셔터 비활성화 dim만으로는 약하다). 임계값과 깜빡임을 막는
 * 이유는 pendingNotice.ts 주석 참고.
 */
const CAPTURE_PENDING_MESSAGE = '사진을 만들고 있어요. 잠시만 기다려주세요';

/** Sentry `feature` 태그 기본값. 화면마다 다르게 보고 싶으면 telemetryFeature로 덮는다 */
const DEFAULT_TELEMETRY_FEATURE = 'character-photo-capture';

// 캐릭터 타입은 이미지 선택 규칙과 함께 characterSource.ts에 있다(그 규칙만 테스트할 수 있게 뗐다).
// 호출부가 이 컴포넌트에서 함께 가져다 쓸 수 있도록 여기서 다시 내보낸다.
export type { PhotoCaptureCharacter };

/** 강조색 기본값. 보물찾기가 쓰던 값이라, 넘기지 않으면 그 화면이 바뀌지 않는다 */
const DEFAULT_ACCENT: PhotoCaptureAccent = 'treasure';

/**
 * 카메라를 기다리는 동안 그리는 자리표시 색.
 *
 * 프리뷰 자리는 화면 흰 배경(styles.screen) 위라 흰 자리표시가 보이지 않아 옅은 회색을 쓰고,
 * 하단 패널은 그보다 한 단계 진한 회색(#f6f5f4 — RoleVerify·together-materials와 같은 값)이다.
 */
const PREVIEW_SKELETON_COLOR = '#efefef';
const PANEL_SKELETON_COLOR = '#f6f5f4';

/**
 * 셔터가 만들어 두고 "완료"를 기다리는 사진.
 *
 * 세 값이 한 덩어리인 이유는 만들어지는 시점이 같기 때문이다 — 셋 다 오프스크린 합성 뷰가
 * 살아 있는 동안에만 만들 수 있고, 미리보기가 그려지는 순간 그 뷰는 사라진다.
 */
interface PendingCapture {
  /** 갤러리에 넣고 미리보기에 그릴 합성본 */
  compositeUri: string;
  /** 서버로 올릴 파일. 축소가 필요 없으면 `compositeUri`와 같고, `onUpload`가 없으면 null */
  uploadUri: string | null;
  /** 셔터를 누른 순간 */
  takenAt: Date;
}

export interface CharacterPhotoCaptureProps {
  /**
   * 함께 사진을 찍을 캐릭터. **넘기지 않으면 캐릭터 없이 카메라만 그린다.**
   *
   * 협동 미션 "재료 찾기"는 합성할 캐릭터가 없다 — 찾은 재료를 그냥 찍는다. 그래도 나머지
   * 촬영 파이프라인(권한·셔터·오프스크린 캡처·미리보기·갤러리 저장·업로드)은 캐릭터와 무관하게
   * 그대로 성립하므로, 캐릭터 레이어만 빼고 이 컴포넌트를 함께 쓴다.
   *
   * 캐릭터가 없어도 **오프스크린 합성 캡처는 그대로 탄다.** 카메라 원본을 바로 쓰면
   * (1) 사진 비율이 센서 비율이라 찍는 화면·미리보기·저장본이 어긋나고(styles.ts 상단 주석),
   * (2) 업로드 파일이 JPEG라는 보장이 사라진다(reactNativeFilePart.ts는 그 사실에 묶여 있다).
   */
  character?: PhotoCaptureCharacter;
  /**
   * `character.imageUrl`이 없거나 로드에 실패했을 때 대신 그릴 로컬 에셋.
   *
   * `character`를 넘겼다면 **함께 넘겨야 한다** — 캐릭터가 비면 "캐릭터와 사진찍기"라는 기능
   * 자체가 성립하지 않는다. 캐릭터를 쓰지 않는 화면에서만 함께 비운다.
   */
  fallbackImage?: ImageSourcePropType;
  /**
   * 하단 패널 안내 문구. 넘기지 않으면 캐릭터 이름으로 만든 기본 문구를 쓴다.
   */
  guideMessage?: string;
  /**
   * 합성 사진을 서버로 올린다. 넘기지 않으면 갤러리 저장만 하고 업로드는 건너뛴다.
   *
   * 엔드포인트를 이 컴포넌트가 알지 않는 이유: 화면마다 올릴 곳이 다르고(마이페이지는 보물찾기
   * 엔드포인트가 아니다), 서버 스펙이 바뀌어도(예: characterId 추가) 공용 컴포넌트를 고치지
   * 않아야 하기 때문이다.
   *
   * @param uri  올릴 JPEG의 file:// URI. 파일 파트로 감쌀 때는 `toReactNativeFilePart`를 쓴다.
   * @param takenAt **셔터를 누른 순간**. 업로드가 늦어져도 이 값이 촬영 시각이다.
   *
   * reject하면 이 컴포넌트가 실패 토스트와 Sentry 보고를 맡는다 — 호출부는 그냥 throw하면 된다.
   */
  onUpload?: (uri: string, takenAt: Date) => Promise<void>;
  /**
   * 화면 상단 크롬(헤더 등). 미션마다 다르므로 호출부가 그린다.
   *
   * `onBack`이 화면마다가 아니라 **상태마다** 다르기 때문에 노드가 아니라 함수로 받는다 —
   * 미리보기에서의 뒤로가기는 화면을 떠나는 게 아니라 카메라로 되돌아가는 것이다.
   */
  renderHeader?: (params: { onBack: () => void }) => ReactNode;
  /**
   * 카메라 화면 위에 얹을 미션 전용 오버레이(예: 보물찾기 진행도 카드 n/3).
   *
   * 카메라 분기에서만 그린다 — 미리보기·권한 안내 화면에는 진행도가 의미 없다.
   * 위치는 호출부가 절대배치로 정한다(이 컴포넌트는 무엇이 올지 모른다).
   */
  cameraOverlay?: ReactNode;
  /** Sentry `feature` 태그. 화면별로 실패를 갈라 보고 싶을 때 지정한다 */
  telemetryFeature?: string;
  /**
   * 이 화면의 강조색. **셔터와 미리보기 "완료"가 함께 따라간다**(사용자 지시).
   *
   * 보물찾기는 초록, 협동 미션은 오렌지, 마이페이지 도감의 "함께 사진 찍기"는 파랑이다.
   * 배치·문구는 미션마다 같으므로 색만 호출부가 고른다. 기본값이 보물찾기라 넘기지 않으면
   * 지금 화면 그대로다. 실제 색값은 styles.ts의 `CAPTURE_ACCENTS`에 짝으로 있다.
   *
   * "다시 찍기"는 따라가지 않는다 — 취소 쪽은 미션 색이 아니라 중립색이어야 두 버튼의 역할이 갈린다.
   */
  accent?: PhotoCaptureAccent;
  /**
   * 갤러리 저장과 업로드가 **모두 끝난 뒤** 다음 단계로 넘길 때 호출.
   *
   * 예전에는 셔터를 누른 직후 저장·업로드를 띄우고 미리보기로 넘어갔다. 그래서 "다시 찍기"를
   * 눌러도 버린 사진이 이미 갤러리에 남고 서버에도 올라가 있었다 — 사용자 지시로 두 일이 모두
   * "완료"를 누른 뒤에만 일어난다.
   */
  onCaptured: () => void;
  /** 촬영 화면에서 뒤로 나갈 때 */
  onBack: () => void;
}

/**
 * 사진을 찍고, 합성해서, 갤러리에 저장하고, (원하면) 서버로 올리는 화면.
 *
 * 이름이 말하는 "캐릭터"는 **선택 레이어**다. `character`를 넘기면 그 캐릭터를 함께 합성하고
 * (보물찾기·마이페이지), 넘기지 않으면 카메라만 그린다(협동 "재료 찾기"). 나머지 흐름은 같다 —
 * 촬영 파이프라인은 무엇이 찍히는지에 매여 있지 않기 때문이다(`character` prop 주석 참고).
 *
 * ## 무엇을 이 컴포넌트가 갖고 있나
 * 카메라 권한 흐름, 셔터, 오프스크린 합성 뷰와 `captureRef`, 미리보기(다시찍기/완료),
 * 갤러리 저장, 지연 토스트. 즉 "촬영 파이프라인" 전부다.
 *
 * ## 셔터와 "완료"가 각각 무엇을 하나
 * 셔터는 **파일을 만드는 데까지만** 간다(촬영 → 합성 캡처 → 업로드본 준비). 그렇게 만든 파일은
 * 미리보기가 들고 있다가 **"완료"를 눌렀을 때** 갤러리에 저장되고 서버로 올라간다.
 * "다시 찍기"를 누르면 그 파일은 어디에도 남지 않고 캐시에서 지워진다.
 *
 * 합성 캡처만 셔터에 남는 이유는 시점 때문이다 — 오프스크린 합성 뷰는 미리보기가 그려지는 순간
 * 언마운트되므로, 그 뷰를 찍는 일(`captureRef`)은 미리보기보다 **먼저** 끝나 있어야 한다.
 *
 * ## 무엇을 호출부가 넣나
 * 미션 전용 크롬(`renderHeader`/`cameraOverlay`)과 업로드(`onUpload`). 둘 다 화면마다 다르고,
 * 여기에 두면 공용 컴포넌트가 특정 미션을 알아야 한다.
 *
 * ## 왜 사진을 두 번 그리나(오프스크린 합성)
 * `takePictureAsync`는 카메라 피드만 캡처하고 RN 오버레이(캐릭터)는 포함하지 않는다
 * (docs/trouble/2026-08-15-treasure-hunt-tech-decisions.md §2). 그래서 찍은 사진을 배경으로 깐
 * 일반 View를 화면 밖에 만들어 두고 그쪽을 다시 캡처한다.
 */
export function CharacterPhotoCapture({
  character,
  fallbackImage,
  guideMessage,
  onUpload,
  renderHeader,
  cameraOverlay,
  telemetryFeature = DEFAULT_TELEMETRY_FEATURE,
  accent = DEFAULT_ACCENT,
  onCaptured,
  onBack,
}: CharacterPhotoCaptureProps) {
  const insets = useSafeAreaInsets();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  /** 셔터 색과 "완료" 색은 같은 강조색에서 함께 나온다(accent prop 주석) */
  const accentStyle = CAPTURE_ACCENTS[accent];

  /**
   * 저장·업로드 결과는 전부 토스트로 알린다(협동 미션과 같은 dark 토스트).
   *
   * 화면 아래 패널에 문구를 함께 두면 버튼과 안내가 뒤엉켜 무엇을 눌러야 하는지가 흐려진다.
   * 패널에는 버튼만 남기고, 사실 전달은 잠깐 떴다 사라지는 토스트가 맡는다.
   */
  const { show: rawShowToast } = useToast();

  /**
   * 화면 아래 영역의 실제 높이(dp). 토스트를 그 위로 밀어 올리는 데만 쓴다.
   *
   * 토스트의 기본 위치는 "하단 CTA 버튼(52) 위 16"인데, **이 화면의 아래에 깔린 것은 버튼이 아니다** —
   * 촬영 중에는 안내 문구와 셔터가 든 흰 패널이고, 미리보기에서는 버튼 두 개가 든 줄이다.
   * 기본값을 그대로 쓰면 토스트가 그 위에 겹쳐 문구와 셔터를 가린다(사용자 지시로 고쳤다).
   *
   * 높이를 상수로 적지 않고 재는 이유: 안내 문구가 길어지면 패널이 자라고, 셔터·여백 값이
   * 바뀌어도 따라가야 한다. 두 분기가 같은 상태를 쓰므로 그때그때 보이는 쪽의 높이가 들어간다.
   */
  const [bottomAreaHeight, setBottomAreaHeight] = useState(0);

  const handleBottomAreaLayout = useCallback((event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    // 같은 값으로 setState를 반복하면 레이아웃 → 렌더 루프가 생긴다(handleFrameLayout과 같은 이유)
    setBottomAreaHeight((current) => (Math.round(current) === Math.round(height) ? current : height));
  }, []);

  /** 홈 인디케이터/네비게이션 바를 피하는 아래 여백. 토스트 위치 계산의 기준이다 */
  const safeBottom = Math.max(insets.bottom, MIN_BOTTOM_INSET);
  /**
   * 하단 영역(셔터 패널·미리보기 버튼 줄)의 아래 여백.
   *
   * 앱의 다른 CTA와 **같은 값**을 쓴다(styles/safeArea.ts의 ctaBottomPadding) —
   * 화면마다 아래 여백이 다르면 그게 곧 어긋남이다(사용자 지시로 셔터 패널까지 맞췄다).
   * 이 화면도 FullBleed 안이라 시스템 바를 스스로 되돌려야 한다(ctaBottomPadding 주석).
   */
  const previewBottomGap = ctaBottomPadding(insets.bottom);

  /**
   * 이 화면의 토스트. 항상 **아래 영역 위로 16**에 뜬다.
   *
   * 잰 높이에는 하단 영역이 이미 갖고 있는 `safeBottom`이 포함돼 있는데, 토스트도 같은 inset을
   * 따로 더한다(`ToastProvider`). 빼 주지 않으면 그만큼 두 번 밀려 안내가 화면 가운데로 떠오른다.
   */
  const showToast = useCallback(
    (message: string) => {
      rawShowToast(message, { bottomClearance: Math.max(bottomAreaHeight - safeBottom, 0) });
    },
    [rawShowToast, bottomAreaHeight, safeBottom],
  );

  const cameraRef = useRef<CameraView>(null);
  const captureViewRef = useRef<View>(null);

  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  // 촬영한 사진의 임시 URI. 값이 있는 동안만 오프스크린 합성용 <Image>를 마운트한다.
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  /**
   * 찍어 두고 아직 **어디에도 저장하지 않은** 사진. 값이 있으면 미리보기 화면을 보여준다.
   *
   * 세 값을 함께 든다. 셋 다 셔터를 누른 시점에만 만들 수 있어서 미리보기가 대신 보관한다:
   * - `compositeUri` 갤러리에 넣고 미리보기에 그릴 합성본
   * - `uploadUri` 서버로 올릴 파일(축소가 필요 없으면 합성본과 같은 파일이다)
   * - `takenAt` **셔터를 누른 순간.** "완료"가 늦어져도 서버가 받는 촬영 시각은 이 값이다
   */
  const [pendingCapture, setPendingCapture] = useState<PendingCapture | null>(null);
  /** "완료"를 눌러 저장·업로드가 진행 중인지. 그동안 두 버튼을 잠근다 */
  const [isConfirming, setIsConfirming] = useState(false);
  /**
   * 카메라가 채우는 실제 영역(dp). 오프스크린 합성 뷰를 이 크기 x captureScale로 만들어
   * 찍는 화면 / 미리보기 / 저장 사진의 비율을 일치시킨다(styles.ts 주석 참고).
   *
   * useWindowDimensions 대신 onLayout으로 재는 이유: 이 화면은 FullBleed 안에 있어서
   * 실제 렌더 높이가 창 높이와 미세하게 다를 수 있고, 사진에 담기는 건 "렌더된 영역"이다.
   */
  const [frameSize, setFrameSize] = useState<{ width: number; height: number } | null>(null);
  /** 서버가 준 캐릭터 이미지 URL을 못 불러왔는지. true면 로컬 에셋으로 되돌린다 */
  const [hasRemoteCharacterFailed, setHasRemoteCharacterFailed] = useState(false);

  // 디자인의 캐릭터(325x324). 무엇을 그릴지(원격 / 로컬 폴백 / 아예 안 그림)는 characterSource.ts가 정한다.
  // null이면 캐릭터 레이어를 화면에도 오프스크린 합성 뷰에도 그리지 않는다.
  const characterSource = resolveCharacterSource({ character, fallbackImage, hasRemoteFailed: hasRemoteCharacterFailed });
  /** 셔터가 캐릭터 이미지의 onLoad를 기다려야 하는지. 객체가 아니라 boolean이라 의존성이 안정적이다 */
  const hasCharacter = characterSource !== null;

  // 조사는 이름의 받침에 따라 갈린다 — 박아 두면 "로컬 탐험가과 함께"가 된다(기기에서 확인)
  const bottomTitle = guideMessage ?? (character?.name ? `${joinWithParticle(character.name, '과', '와')} 함께 추억을 남겨보세요!` : 'AR 캐릭터와 함께 추억을 남겨보세요!');

  /**
   * 실패를 흘려보내지 않고 남긴다.
   *
   * 이 화면의 토스트는 전부 "무엇이 안 됐는지"만 말하고 "왜"는 말하지 않는다 — 사용자에게 보여 줄
   * 문구로는 그게 맞지만, 그 대가로 제보를 받아도 원인을 알 수 없었다(캡처 OOM인지, 권한인지,
   * 400인지, 네트워크인지가 전부 같은 문구로 보인다). 브릿지(`src/bridge/utils.ts`)와 같은 방식으로
   * Sentry에 원문을 올려 다음 제보 때는 로그로 바로 갈라 볼 수 있게 한다.
   */
  const reportFailure = useCallback(
    (scope: string, error: unknown): void => {
      console.error(`[CharacterPhotoCapture] ${telemetryFeature} ${scope}`, error);
      Sentry.captureException(error instanceof Error ? error : new Error(`${scope}: ${String(error)}`), {
        tags: { feature: telemetryFeature, scope },
      });
    },
    [telemetryFeature],
  );

  function handleFrameLayout(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout;
    if (width <= 0 || height <= 0) return;
    // 같은 값으로 setState를 반복하면 레이아웃 → 렌더 루프가 생긴다
    if (frameSize && Math.round(frameSize.width) === Math.round(width) && Math.round(frameSize.height) === Math.round(height)) return;
    setFrameSize({ width, height });
  }

  // 최초 진입 시 상태가 'undetermined'(아직 한 번도 물어본 적 없음)이면 바로 시스템 다이얼로그를 띄운다.
  // 이미 거부된 상태('denied')는 자동 재요청하지 않는다 — OS가 재요청을 막거나(canAskAgain=false)
  // 매 진입마다 다이얼로그가 뜨는 게 오히려 방해가 되므로, 아래 blocked 분기의 버튼으로만 재시도하게 한다.
  useEffect(() => {
    if (cameraPermission?.status === 'undetermined') {
      requestCameraPermission();
    }
  }, [cameraPermission?.status, requestCameraPermission]);

  // takePictureAsync 직후 setPhotoUri로 오프스크린 <Image> 두 장을 마운트하지만,
  // 이미지 디코딩은 비동기라 onLoad가 오기 전에 captureRef를 호출하면 배경/캐릭터가 비어 보일 수 있다.
  // Promise + ref 콜백으로 "두 이미지가 실제로 그려졌다"를 기다린다.
  const backgroundLoadRef = useRef<{ resolve: () => void; reject: (e: Error) => void } | null>(null);
  const characterLoadRef = useRef<{ resolve: () => void; reject: (e: Error) => void } | null>(null);

  const waitForImageLoad = useCallback((which: 'background' | 'character') => {
    return new Promise<void>((resolve, reject) => {
      const entry = { resolve, reject };
      if (which === 'background') {
        backgroundLoadRef.current = entry;
      } else {
        characterLoadRef.current = entry;
      }
    });
  }, []);

  /**
   * 오프스크린 합성 뷰를 화면 dp의 몇 배로 만들지.
   *
   * 고정 3배였다가 기기 픽셀 배율에서 역산한 값으로 바뀌었다 — 근거는 compositeCaptureScale.ts.
   * 요약하면 dp에 화면 배율이 한 번 더 곱해져 3배 뷰가 화면 픽셀 면적의 9배(약 89MiB) 비트맵이
   * 되고, 그 할당이 셔터 한 번에 두 번 일어나 캡처가 통째로 실패하고 있었다.
   */
  const captureScale = useMemo(() => {
    if (!frameSize) return 1;
    return resolveCompositeCaptureScale({ frameWidthDp: frameSize.width, frameHeightDp: frameSize.height, pixelRatio: PixelRatio.get() });
  }, [frameSize]);

  const characterCaptureStyle = useMemo(() => compositeCharacterStyle(captureScale), [captureScale]);

  /**
   * 서버에 올릴 파일의 URI를 정한다. 실패하면 null.
   *
   * 합성본이 이미 10MB 한도 안이면 **그 파일을 그대로 올린다**(= compositeUri를 돌려준다).
   * 예전에는 무조건 한 번 더 떴는데, 그 한 번이 23MP 비트맵을 다시 만드는 일이라
   * "사진을 서버에 올리지 못했어요"만 남기고 끝나는 실패 지점이었다. 지금은 캡처 배율이
   * 픽셀 한도를 지키므로 흔한 기기에서는 이 두 번째 캡처 자체가 사라진다.
   *
   * 한도를 넘는 기기(화면 픽셀이 한도보다 큰 경우)에서만 축소본을 한 번 더 뜬다.
   *
   * **호출 시점이 중요하다** — 미리보기(pendingCapture)가 그려지면 컴포넌트가 미리보기 분기에서
   * 바로 return하고 오프스크린 합성 뷰가 언마운트된다. 그러면 captureViewRef가 비어 캡처가 실패한다.
   * 그래서 setPendingCapture **이전**에 떠야 한다. 업로드가 "완료"로 미뤄진 뒤에도 이 순서는 그대로다 —
   * 미룬 것은 **전송**이지 파일을 만드는 일이 아니다.
   */
  const resolveUploadUri = useCallback(
    async (compositeUri: string): Promise<string | null> => {
      if (!frameSize) return null;

      const uploadSize = resolveUploadCaptureSize({
        viewWidthDp: frameSize.width * captureScale,
        viewHeightDp: frameSize.height * captureScale,
        pixelRatio: PixelRatio.get(),
        // captureRef의 width/height 단위가 플랫폼마다 다르다 — uploadCaptureSize.ts의 optionUnit 주석 참고
        optionUnit: Platform.OS === 'ios' ? 'dp' : 'px',
      });

      // null = 축소가 필요 없다. 합성본을 그대로 올린다.
      if (uploadSize === null) return compositeUri;

      try {
        return await captureRef(captureViewRef, { format: 'jpg', quality: COMPOSITE_JPEG_QUALITY, ...uploadSize });
      } catch (error) {
        // 사진 자체는 이미 떴다 — 이 실패는 "업로드가 안 됐다"일 뿐이므로 촬영 실패로 알리지 않는다
        if (!wasApiErrorNotified(error)) showToast('사진을 서버에 올리지 못했어요');
        reportFailure('upload capture failed', error);
        return null;
      }
    },
    [frameSize, captureScale, showToast, reportFailure],
  );

  /**
   * 합성 사진을 서버에 올린다. **"완료"를 누른 뒤에만 부르고, 끝날 때까지 기다린다**(handleConfirm).
   *
   * 어디로 올릴지는 `onUpload`가 안다. 여기가 책임지는 건 **실패를 사용자와 Sentry에 알리는 것**과
   * **임시 파일 정리**뿐이다 — 그 둘은 파일을 만든 쪽이 해야 맞다.
   *
   * HEIC 변환은 하지 않는다 — 올리는 파일은 `takePictureAsync`의 결과물이 아니라 captureRef가
   * `format: 'jpg'`로 만든 JPEG다(카메라 원본은 합성 배경으로만 쓰이는 중간 산물이다).
   */
  const uploadPicture = useCallback(
    async (uploadUri: string, takenAt: Date, isTempCopy: boolean) => {
      try {
        await onUpload?.(uploadUri, takenAt);
      } catch (error) {
        // 서버 오류 메시지는 공통 토스트로 표시하고 응답 없는 실패만 기존 안내를 사용한다.
        if (!wasApiErrorNotified(error)) showToast('사진을 서버에 올리지 못했어요');
        reportFailure('upload failed', error);
      } finally {
        // 업로드 전용으로 한 번 더 뜬 축소본만 지운다 — 갤러리에도 미리보기에도 안 쓰이므로
        // 남겨 두면 캡처마다 캐시에 수 MB씩 쌓인다(RNViewShotModule.releaseCapture는 캐시
        // 디렉터리 안일 때만 삭제한다).
        //
        // 합성본을 그대로 올린 경우(isTempCopy=false)에는 절대 지우면 안 된다.
        // 그 파일은 지금 미리보기 <Image>가 화면에 그리고 있는 파일이다.
        if (isTempCopy) releaseCapture(uploadUri);
      }
    },
    [onUpload, showToast, reportFailure],
  );

  /**
   * 갤러리에 저장한다. **"완료"를 누른 뒤에만 부른다.**
   *
   * 미리보기로 넘어가는 길목에서는 부르지 않는다 — 그러면 "다시 찍기"로 버린 사진까지
   * 갤러리에 남는다. 셔터 직후에 띄우던 예전 방식은 미리보기를 빨리 보여주려던 것이었는데,
   * 지금은 저장 자체가 미리보기 다음 일이라 기다리게 할 화면이 없다.
   */
  const saveToGallery = useCallback(
    async (uri: string) => {
      try {
        // expo-media-library 56부터 saveToLibraryAsync는 "legacy" 스텁이라 호출 즉시 throw한다
        // (node_modules/expo-media-library/src/legacyWarnings.ts — 본체는 expo-media-library/legacy로 이동).
        // 새 클래스 API인 Asset.create가 대체 경로다. captureRef가 돌려주는 file:// URI를 그대로 받는다.
        await MediaLibrary.Asset.create(uri);
        showToast('사진이 갤러리에 저장되었어요');
      } catch (error) {
        showToast('갤러리에 저장하지 못했어요');
        reportFailure('gallery save failed', error);
      }
    },
    [showToast, reportFailure],
  );

  const handleShutterPress = useCallback(async () => {
    // 중복 탭 방지: 촬영~합성~저장이 전부 비동기라 연타하면 사진이 여러 장 찍히거나
    // 아직 로딩 중인 오프스크린 뷰를 두 번 캡처하게 된다.
    // frameSize가 없으면 오프스크린 합성 뷰 크기를 정할 수 없어 사진 비율이 어긋난다
    const camera = cameraRef.current;
    if (isProcessing || !isCameraReady || !camera || !frameSize) {
      return;
    }

    setIsProcessing(true);

    // 200ms 안에 끝나면 아무것도 뜨지 않는다(pendingNotice.ts). 그보다 길어질 때만 알린다.
    const cancelPendingNotice = schedulePendingNotice(() => showToast(CAPTURE_PENDING_MESSAGE));

    try {
      // 미디어 라이브러리 저장 권한을 사진을 찍기 전에 먼저 확인한다.
      // 어차피 저장을 못 하면 촬영 자체가 무의미하므로, 카메라 세션을 낭비하지 않는다.
      // writeOnly(true): 이 화면은 저장만 하고 기존 앨범을 읽지 않으므로 최소 권한만 요청한다.
      const mediaPermission = await MediaLibrary.requestPermissionsAsync(true);
      const mediaGuidance = resolvePermissionGuidance(mediaPermission, '사진 저장');
      if (mediaGuidance.blocked) {
        if (mediaGuidance.canOpenSettings) {
          Alert.alert('사진 저장 권한 필요', mediaGuidance.message, [
            { text: '취소', style: 'cancel' },
            { text: '설정 열기', onPress: () => Linking.openSettings() },
          ]);
        } else {
          Alert.alert('사진 저장 권한 필요', mediaGuidance.message);
        }
        return;
      }

      // 촬영 시각은 셔터가 눌린 이 순간이다. 업로드가 늦어지거나 재시도되더라도 이 값을 보낸다 —
      // 서버의 takenAt은 "사진을 찍은 시각"이고 "전송한 시각"이 아니다.
      const takenAt = new Date();
      // ref를 await 뒤에 다시 읽지 않는다 — 그 사이 화면이 바뀌면 null이 되어 있을 수 있다
      const photo = await camera.takePictureAsync({ quality: 0.9 });

      // 오프스크린 <Image>를 마운트하고 onLoad를 기다린다(위 waitForImageLoad 주석 참고).
      // 캐릭터가 없는 화면에서는 그 <Image>를 아예 그리지 않으므로 onLoad도 오지 않는다 —
      // 기다리면 IMAGE_LOAD_TIMEOUT_MS를 다 채우고 촬영이 통째로 실패한다.
      const bgLoaded = waitForImageLoad('background');
      const charLoaded = hasCharacter ? waitForImageLoad('character') : Promise.resolve();
      setPhotoUri(photo.uri);
      await withTimeout(Promise.all([bgLoaded, charLoaded]), IMAGE_LOAD_TIMEOUT_MS, 'composite image load timed out');

      if (!captureViewRef.current) {
        throw new Error('capture view is not mounted');
      }

      // 사진을 배경으로 깐 오프스크린 View를 이 시점에 캡처한다(컴포넌트 헤더 주석 참고).
      const compositeUri = await captureRef(captureViewRef, {
        format: 'jpg',
        quality: COMPOSITE_JPEG_QUALITY,
      });

      // 업로드본은 오프스크린 합성 뷰가 살아 있는 지금 정해야 한다(resolveUploadUri 주석 참고).
      // 미리보기가 그려지면 이 컴포넌트가 미리보기 분기에서 return하며 그 뷰가 사라진다.
      // 축소가 필요 없으면 합성본을 그대로 돌려주므로 캡처는 셔터당 한 번으로 끝난다.
      const uploadUri = onUpload ? await resolveUploadUri(compositeUri) : null;

      // 여기서 셔터의 일이 끝난다. **갤러리 저장도 업로드도 하지 않는다** —
      // 두 일은 "완료"를 눌렀을 때만 일어난다(handleConfirm). 만들어 둔 파일만 넘긴다.
      setPendingCapture({ compositeUri, uploadUri, takenAt });
    } catch (error) {
      // 조용히 삼키지 않는다 — 사용자가 재시도할 수 있도록 실패를 명시적으로 알린다.
      showToast('사진을 찍지 못했어요. 다시 시도해주세요');
      reportFailure('capture failed', error);
    } finally {
      // 이미 떠 버린 안내는 되돌리지 않는다 — 여기서 강제로 내리면 그게 곧 깜빡임이다.
      // 토스트는 큐라(components/Toast/toastQueue.ts) 뒤이어 나올 저장·업로드 결과와 겹치지 않는다.
      cancelPendingNotice();
      setPhotoUri(null);
      setIsProcessing(false);
    }
  }, [isProcessing, isCameraReady, waitForImageLoad, hasCharacter, frameSize, onUpload, resolveUploadUri, showToast, reportFailure]);

  /**
   * "다시 찍기" — 찍어 둔 사진을 **어디에도 남기지 않고** 버린다.
   *
   * 캐시 파일을 지우는 것이 이 함수의 실질이다. 예전에는 이 사진이 이미 갤러리에 저장된 뒤라
   * 지울 것이 없었지만, 지금은 저장 전이라 여기서 정리하지 않으면 촬영을 다시 할 때마다
   * 수 MB짜리 합성본이 캐시에 쌓인다(releaseCapture는 캐시 디렉터리 안일 때만 지운다).
   */
  const discardPending = useCallback(() => {
    if (pendingCapture === null) return;

    const { compositeUri, uploadUri } = pendingCapture;
    // 화면에서 먼저 떼어낸다 — 미리보기 <Image>가 그리고 있는 파일을 먼저 지우면 빈 칸이 보인다
    setPendingCapture(null);

    if (uploadUri !== null && uploadUri !== compositeUri) releaseCapture(uploadUri);
    releaseCapture(compositeUri);
  }, [pendingCapture]);

  /**
   * "완료" — 이제야 갤러리에 저장하고 서버로 올린다.
   *
   * 둘 다 **끝날 때까지 기다린 뒤** 다음 단계로 넘긴다. 예전처럼 띄워 놓고 넘어가면 협동 미션의
   * 인증 판정(200 + isVerified)이 역할 목록으로 돌아간 **뒤에** 도착해서, 방금 올린 사진이
   * 잠깐 반영되지 않은 화면을 보게 된다.
   *
   * 실패는 각자 안에서 토스트로 알리고 여기서 다시 던지지 않는다 — 저장이나 전송이 실패했다고
   * 미리보기에 붙잡아 두면 빠져나갈 길이 없다(사진은 이미 찍혔고 다시 찍어도 같은 결과다).
   */
  const handleConfirm = useCallback(async () => {
    if (pendingCapture === null || isConfirming) return;

    const { compositeUri, uploadUri, takenAt } = pendingCapture;
    setIsConfirming(true);
    try {
      await saveToGallery(compositeUri);
      if (uploadUri !== null) await uploadPicture(uploadUri, takenAt, uploadUri !== compositeUri);
    } finally {
      setIsConfirming(false);
    }

    setPendingCapture(null);
    onCaptured();
  }, [pendingCapture, isConfirming, saveToGallery, uploadPicture, onCaptured]);

  if (!cameraPermission) {
    /**
     * useCameraPermissions는 마운트 직후 상태 조회가 끝나기 전엔 null을 준다. 짧은 로딩 상태.
     *
     * 예전에는 "카메라를 준비하고 있어요" 한 줄이었다. 문구는 **기다려도 바뀌지 않는 상태**에
     * 쓰는 것이고(아래 권한 거부 갈래), 이 자리는 곧 채워지는 자리라 자리표시로 바꿨다 —
     * 앱의 로딩 표현을 스켈레톤으로 통일한다는 지시.
     *
     * 모양은 바로 다음에 올 촬영 화면 그대로다: 화면을 꽉 채우는 프리뷰 + 하단 흰 패널(제목 한 줄
     * 26 + gap 16 + 셔터 76). 패널의 여백·간격은 styles.bottomPanel을 그대로 쓰므로 카메라가
     * 뜨는 순간 셔터 자리가 움직이지 않는다.
     */
    return (
      <View style={styles.screen}>
        {/* 프리뷰가 들어올 자리. 카메라가 화면 전체를 덮으므로 자리표시도 같은 absolute 상자를 쓴다 */}
        <View style={[styles.cameraFill, styles.cameraFillPlain]}>
          <SkeletonBlock width="100%" height="100%" radius={0} color={PREVIEW_SKELETON_COLOR} />
        </View>

        {renderHeader?.({ onBack })}

        <View style={styles.bottomStack}>
          <View style={[styles.bottomPanel, { paddingBottom: previewBottomGap }]} accessible accessibilityLabel="카메라를 준비하는 중">
            <View style={styles.bottomLabels}>
              {/* bottomTitle은 18/26 — 같은 26을 잡아야 셔터가 위아래로 밀리지 않는다 */}
              <SkeletonBlock width={200} height={26} radius={8} color={PANEL_SKELETON_COLOR} />
            </View>
            {/* ShutterOuter 76x76 */}
            <SkeletonBlock width={76} height={76} color={PANEL_SKELETON_COLOR} />
          </View>
        </View>
      </View>
    );
  }

  const cameraGuidance = resolvePermissionGuidance(cameraPermission, '카메라');
  if (cameraGuidance.blocked) {
    return (
      <View style={styles.screen}>
        {renderHeader?.({ onBack })}
        <View style={styles.centerMessage}>
          <Text style={styles.centerMessageText}>{cameraGuidance.message}</Text>
          <Pressable style={styles.centerMessageButton} onPress={() => (cameraGuidance.canOpenSettings ? Linking.openSettings() : requestCameraPermission())}>
            <Text style={styles.centerMessageButtonText}>{cameraGuidance.canOpenSettings ? '설정으로 이동' : '카메라 권한 허용하기'}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // 미리보기 — 사진은 찍혔지만 **아직 아무 데도 저장되지 않은** 상태다.
  // "다시 찍기"는 그 사진을 버리고 카메라로 되돌리고, "완료"가 저장·업로드를 하고 다음으로 넘긴다.
  if (pendingCapture) {
    return (
      <View style={styles.screen}>
        {/* 사진이 화면 전체를 덮으므로 헤더보다 먼저 그린다 — 순서가 바뀌면 헤더가 사진에 가려진다.
            합성 사진의 비율이 화면과 같아 cover로 깔아도 잘리지 않는다(찍을 때 본 프레임 그대로) */}
        <Image source={{ uri: pendingCapture.compositeUri }} style={styles.previewImage} resizeMode="cover" />

        {/* 미리보기의 뒤로가기는 촬영 화면으로 되돌린다("다시 찍기"와 같은 동작) */}
        {renderHeader?.({ onBack: discardPending })}

        {/* 배경판 없이 버튼만 사진 위에 뜬다(styles.previewBottomArea 주석).
            padding은 그대로 둔다 — 배경이 없어도 홈 인디케이터/네비게이션바에 버튼이 붙으면 안 된다 */}
        <View style={[styles.previewBottomArea, { paddingBottom: previewBottomGap }]} onLayout={handleBottomAreaLayout}>
          {/* 저장·업로드 결과는 토스트가 말한다. 이 자리에는 버튼만 둔다.
              진행 중에는 라벨로 알리고 두 버튼을 함께 잠근다 — 저장·전송이 도는 동안 "다시 찍기"가
              눌리면 지금 올라가는 중인 파일을 지우게 된다 */}
          <View style={styles.previewButtonRow}>
            <View style={styles.previewButton}>
              <Button type="outline" color="cool-neutral" text="다시 찍기" disabled={isConfirming} onPress={discardPending} />
            </View>
            <View style={styles.previewButton}>
              <Button color={accentStyle.confirmButton} bold text={isConfirming ? '저장 중...' : '완료'} disabled={isConfirming} onPress={() => void handleConfirm()} />
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    // 사진에 담기는 영역이 곧 이 뷰다 — 여기서 잰 크기로 오프스크린 합성 뷰를 만든다
    <View style={styles.screen} onLayout={handleFrameLayout}>
      {/* LiveCameraFeed: 화면 전체를 꽉 채우는 풀블리드 카메라. 헤더/카드/토스트/패널은 전부 이 위 오버레이다.
          검은 판(cameraFill의 배경색)은 캐릭터 합성 화면의 어두운 톤을 전제로 깔린 것이라, 캐릭터가 없는
          화면에서는 걷어낸다 — cameraFillPlain 주석 참고 */}
      <CameraView
        ref={cameraRef}
        style={[styles.cameraFill, !hasCharacter && styles.cameraFillPlain]}
        facing="back"
        onCameraReady={() => setIsCameraReady(true)}
        onMountError={() => Alert.alert('카메라 오류', '카메라를 시작하지 못했어요. 앱을 다시 열어주세요.')}
      />
      {/* 35% 딤은 캐릭터를 카메라 위에 얹었을 때의 톤이다(Penpot TreasureHunt_step2).
          캐릭터가 없는 화면에서는 딤이 가리는 대상이 곧 찍어야 할 피사체라 그리지 않는다 */}
      {hasCharacter && <View style={styles.dimOverlay} pointerEvents="none" />}
      {/* Image는 이 RN 버전 타입에 pointerEvents prop이 없어 View로 감싸 터치를 막는다 */}
      {characterSource !== null && (
        <View style={styles.characterOverlay} pointerEvents="none">
          <Image
            source={characterSource}
            style={styles.characterOverlayImage}
            // 캐릭터 자리는 디자인 값(325x324)으로 고정인데 캐릭터 그림의 비율은 제각각이다.
            // 기본값(cover)이면 넘치는 쪽이 잘려 머리나 발이 사라진다(사용자 확인) — 통째로 담는다.
            resizeMode="contain"
            onError={() => {
              if (__DEV__) console.warn('[CharacterPhotoCapture] 캐릭터 이미지를 불러오지 못했습니다:', character?.imageUrl);
              setHasRemoteCharacterFailed(true);
            }}
          />
        </View>
      )}

      {renderHeader?.({ onBack })}

      {cameraOverlay}

      <View style={styles.bottomStack} onLayout={handleBottomAreaLayout}>
        {/* BottomArea(panel): 하단 padding은 실제 홈 인디케이터 영역(insets.bottom)으로 대체한다 */}
        <View style={[styles.bottomPanel, { paddingBottom: previewBottomGap }]}>
          <View style={styles.bottomLabels}>
            {/* 캐릭터 이름은 화면마다 다르고 아직 못 받았을 수도 있다 — 그때는 이름 없이 부른다.
                두 줄에서 끊는다 — 협동 미션은 역할명과 장소를 함께 담아 문구가 길어질 수 있는데,
                줄 수가 늘면 패널이 자라 셔터가 화면 위로 밀려 올라간다 */}
            <Text style={styles.bottomTitle} numberOfLines={2}>
              {bottomTitle}
            </Text>
          </View>

          <Pressable
            onPress={handleShutterPress}
            disabled={isProcessing || !isCameraReady || !frameSize}
            hitSlop={8}
            accessibilityLabel="사진 촬영"
            style={[
              styles.shutterOuter,
              { backgroundColor: accentStyle.shutterFill, borderColor: accentStyle.shutterRing },
              (isProcessing || !isCameraReady || !frameSize) && styles.shutterOuterDisabled,
            ]}
          >
            <View style={styles.shutterInner} />
          </Pressable>
        </View>
      </View>

      {/*
        오프스크린 합성 캡처 대상. styles.ts의 offscreenCapture 주석 참고:
        opacity:0 대신 화면 밖 좌표 배치를 택했다.
        collapsable={false} — Android RN이 "아무것도 직접 그리지 않는 뷰"를 레이아웃 최적화로
        네이티브 트리에서 접어버리는 현상(view flattening) 때문에 react-native-view-shot 문서가
        명시적으로 권장하는 설정이다. 이게 없으면 captureRef가 뷰를 찾지 못하거나 빈 이미지를 반환할 수 있다.
      */}
      <View ref={captureViewRef} collapsable={false} style={[styles.offscreenCapture, frameSize && { width: frameSize.width * captureScale, height: frameSize.height * captureScale }]}>
        {photoUri && (
          <>
            <Image
              source={{ uri: photoUri }}
              style={styles.captureBackground}
              resizeMode="cover"
              /**
               * 페이드인을 끈다(Android 전용 prop, iOS에서는 무시된다).
               *
               * RN Android의 `Image`는 기본 300ms에 걸쳐 opacity 0→1로 나타난다. `onLoad`는
               * **디코딩이 끝난 시점**에 오고 페이드는 거기서 시작하므로, 우리가 그 신호를 받고
               * 곧바로 `captureRef`를 부르면 아직 반투명한 사진이 찍힌다 — 저장본과 미리보기가
               * 통째로 어두워 보이던 원인이 이것이다(styles.ts의 offscreenCapture 주석 참고).
               */
              fadeDuration={0}
              onLoad={() => backgroundLoadRef.current?.resolve()}
              onError={() => backgroundLoadRef.current?.reject(new Error('background image failed to load'))}
            />
            {characterSource !== null && (
              <Image
                source={characterSource}
                style={characterCaptureStyle}
                // 화면 오버레이와 **같은 맞춤**이어야 한다 — 다르면 본 것과 찍힌 것이 달라진다
                resizeMode="contain"
                // 배경과 같은 이유로 페이드인을 끈다 — 캐릭터가 반투명하게 찍히면 합성이 흐려진다
                fadeDuration={0}
                onLoad={() => characterLoadRef.current?.resolve()}
                onError={() => {
                  // 화면 오버레이와 같은 폴백을 여기에도 건다. 예전에는 이 자리에만 폴백이 없어서
                  // 서버 캐릭터 URL이 죽으면 촬영이 매번 같은 이유로 실패했다(다음 시도도 마찬가지).
                  // 이번 촬영은 그대로 실패하되, 로컬 에셋으로 되돌려 다음 셔터는 성공하게 한다.
                  setHasRemoteCharacterFailed(true);
                  characterLoadRef.current?.reject(new Error('character image failed to load'));
                }}
              />
            )}
          </>
        )}
      </View>
    </View>
  );
}
