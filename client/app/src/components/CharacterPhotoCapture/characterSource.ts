/**
 * "지금 어떤 캐릭터 이미지를 그릴 것인가"를 정한다.
 *
 * 화면 오버레이와 오프스크린 합성 뷰가 **같은 값**을 써야 "본 그대로" 저장된다. 그래서 판단을
 * 컴포넌트 안 삼항식으로 흩뜨리지 않고 한 곳에 모은다 — 캐릭터를 아예 쓰지 않는 화면이
 * 생기면서(협동 "재료 찾기") 경우가 넷으로 늘었고, 그중 하나만 어긋나도 이미 돌아가는
 * 보물찾기 화면이 조용히 달라진다.
 */
import type { ImageSourcePropType } from 'react-native';

/**
 * 함께 사진을 찍을 캐릭터.
 *
 * 세 화면(보물찾기 step3 / "보물이랑 사진찍기" / 마이페이지)이 각자 다른 캐릭터를 넘긴다.
 */
export interface PhotoCaptureCharacter {
  /**
   * 캐릭터 식별자.
   *
   * **id는 서버로 가지 않는다 — 어떤 캐릭터로 합성할지 고르는 클라이언트 값이다.**
   * 업로드는 사진만 보낸다(`{ picture, takenAt }`). 호출부가 "이 캐릭터로 찍는다"를 정해서
   * 넘겨 주는 값이고, 여기서는 React key·로컬 에셋 조회 같은 화면 내부 식별에만 쓴다.
   *
   * 흐름은 항상 **호출부 → 촬영 화면** 한 방향이다. 라우트를 건너뛰면 props로,
   * 라우트를 타고 들어오면(마이페이지 등) `useLocalSearchParams`로 받아 여기에 넣는다.
   */
  id: number | string;
  /**
   * 캐릭터 이름. 하단 안내 문구에 쓴다.
   * 아직 못 받았으면 null이고, 그때는 캐릭터를 특정하지 않는 문구로 대체한다.
   */
  name: string | null;
  /**
   * 서버가 준 캐릭터 이미지 URL.
   *
   * null이거나 못 불러오면 `fallbackImage`로 되돌린다. 현재 시드 데이터의 이미지 호스트가
   * 살아 있지 않아 **실제로 그려지는 건 대부분 fallbackImage**다 — 그래서 그쪽이 사실상 필수다.
   */
  imageUrl: string | null;
}

interface CharacterSourceInput {
  /** 촬영 화면이 받은 캐릭터. 캐릭터를 쓰지 않는 화면에서는 undefined다 */
  character: PhotoCaptureCharacter | undefined;
  /** 원격 URL을 쓸 수 없을 때 대신 그릴 로컬 에셋 */
  fallbackImage: ImageSourcePropType | undefined;
  /** 원격 URL 로드가 실패한 적이 있는지. 한 번 실패하면 그 화면에서는 계속 로컬 에셋을 쓴다 */
  hasRemoteFailed: boolean;
}

/**
 * 그릴 캐릭터 이미지를 고른다. **캐릭터를 그리지 않아야 하면 null이다.**
 *
 * 서버가 준 URL을 먼저 쓴다 — 로컬 에셋은 서버 연결 전에 쓰던 그림이라 실제 캐릭터와 다를 수 있다.
 * URL이 비었거나 **있는데 못 불러온** 경우(404·만료 서명·cleartext 차단)를 같은 자리로 떨어뜨려
 * 로컬 에셋으로 받친다. 예전에는 그 실패 경로가 없어서 캐릭터가 통째로 사라진 채 카메라만 남았다 —
 * 로컬 에셋은 멀쩡히 있는데도.
 *
 * null이 되는 건 두 가지다: 캐릭터를 받지 않았거나(협동 "재료 찾기"), 캐릭터를 받았는데 URL도
 * 로컬 에셋도 없어 그릴 것이 남지 않은 경우. 둘 다 캐릭터 레이어를 그리지 않는 쪽이 맞다 —
 * 뒤쪽은 원래도 빈 이미지만 나왔고, 그 빈 <Image>의 onLoad를 기다리다 촬영이 멈추는 편이 나쁘다.
 */
export function resolveCharacterSource({ character, fallbackImage, hasRemoteFailed }: CharacterSourceInput): ImageSourcePropType | null {
  if (character === undefined) return null;
  // 빈 문자열도 "URL이 없다"로 본다 — <Image source={{ uri: '' }}>는 아무것도 그리지 않는다
  if (character.imageUrl && !hasRemoteFailed) return { uri: character.imageUrl };
  return fallbackImage ?? null;
}
