import { useCallback, useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CharacterPhotoCapture } from '@/components/CharacterPhotoCapture/CharacterPhotoCapture';
import { toReactNativeFilePart } from '@/components/CharacterPhotoCapture/reactNativeFilePart';
import { TreasureHeader } from '@/components/Treasure/TreasureHeader/TreasureHeader';
import { TreasureProgressCard } from '@/components/Treasure/TreasureProgressCard/TreasureProgressCard';
import { Treasure } from '@/constants/treasureHunt';
import { useSavePictureWithCharacterApiV1TreasureMissionsPicturesWithCharacterPost } from '@/services/api/treasure-mission/treasure-mission';
import { toKstTimestamp } from '@/utils/kstTimestamp';
import { PROGRESS_CARD_TOP_OFFSET, treasureHuntPhotoStyles as styles } from './styles';

interface TreasureHuntPhotoProps {
  /**
   * 서버가 준 AR 캐릭터 id. 미션 홈을 아직 못 받았으면 null이다.
   *
   * **id는 서버로 가지 않는다 — 어떤 캐릭터로 합성할지 고르는 클라이언트 값이다.**
   * 업로드(`handleUpload`)는 사진과 촬영 시각만 보낸다.
   */
  characterId?: number | null;
  /**
   * 서버가 준 AR 캐릭터 이름. 안내 문구에 쓴다.
   * 미션 홈을 아직 못 받았으면 null이고, 그때는 캐릭터를 특정하지 않는 문구로 대체한다.
   */
  characterName?: string | null;
  /**
   * 서버가 준 AR 캐릭터 이미지 URL.
   *
   * null이면 보상 종류별 로컬 에셋(constants/treasureHunt.ts의 TREASURE_ASSETS)으로 받친다 —
   * 그 에셋은 서버 연결 전에 쓰던 값이라 실제 캐릭터와 다를 수 있다.
   */
  characterImageUrl?: string | null;
  /** 촬영 대상 캐릭터. 획득 모달에서 "캐릭터와 사진찍기"를 고른 character 타입 보물만 여기로 들어온다 */
  treasure: Treasure;
  /** 찾은 보물 개수. 진행도 카드(n/3)에 표시된다 */
  foundCount: number;
  /** 찾아야 하는 전체 개수. 서버가 준 treasureCount다 */
  totalCount: number;
  /**
   * 진행도 카드(n/3)를 그릴지. 기본은 그린다.
   *
   * **보물을 찾는 중일 때만 의미가 있는 표시다**(사용자 지시). 미션을 이미 끝낸 뒤
   * "보물이랑 사진찍기"로 들어오면 진행할 단계가 없어 "0/3"처럼 사실과 다른 숫자가 뜬다.
   * 협동 미션은 이 컴포넌트를 쓰지 않으므로 애초에 해당하지 않는다.
   */
  showProgress?: boolean;
  /** 미리보기에서 "완료"까지 누른 뒤 상위가 다음 단계로 넘길 때 호출 */
  onCaptured: () => void;
  onBack: () => void;
}

/**
 * 보물찾기 step3 — AR 캐릭터와 사진 찍기.
 *
 * 촬영 파이프라인 자체(권한·셔터·합성·갤러리 저장·미리보기)는 공용
 * `CharacterPhotoCapture`가 갖고 있고, 이 파일은 **보물찾기만의 것** 셋을 얹는다:
 *
 * 1. 크롬 — `TreasureHeader`와 진행도 카드(n/3). 공용 컴포넌트가 미션을 알면 안 되므로 slot으로 넣는다.
 * 2. 업로드 — 보물찾기 엔드포인트. 마이페이지는 다른 곳에 올리므로 콜백으로 주입한다.
 * 3. 캐릭터 폴백 에셋 — 보상 종류별 로컬 이미지.
 */
export function TreasureHuntPhoto({ treasure, characterId, characterName, characterImageUrl, foundCount, totalCount, showProgress = true, onCaptured, onBack }: TreasureHuntPhotoProps) {
  const insets = useSafeAreaInsets();

  // POST /api/v1/treasure-missions/pictures-with-character. mutateAsync만 꺼내 의존성을 안정시킨다
  // (훅이 돌려주는 객체는 렌더마다 새로 만들어진다).
  const { mutateAsync: savePictureWithCharacter } = useSavePictureWithCharacterApiV1TreasureMissionsPicturesWithCharacterPost();

  /**
   * 합성 사진을 보물찾기 엔드포인트로 올린다.
   *
   * 실패를 여기서 잡지 않는다 — 던지면 `CharacterPhotoCapture`가 토스트와 Sentry 보고,
   * 임시 파일 정리까지 맡는다(파일을 만든 쪽이 치우는 게 맞다).
   */
  const handleUpload = useCallback(
    async (uri: string, takenAt: Date) => {
      await savePictureWithCharacter({
        data: {
          // 생성 타입의 picture는 OpenAPI multipart 스키마에서 온 `Blob`이다. RN에는 file:// URI로
          // Blob을 만드는 경로가 없고, RN의 FormData는 `{ uri, name, type }` 객체를 파일 파트로
          // 바꾼다(reactNativeFilePart.ts 주석 참고). 즉 선언 타입과 런타임 값이 갈라지는 지점은
          // 여기 한 줄뿐이다.
          // 생성 파일(src/services/api/**)은 `pnpm generate`가 덮어쓰므로 고칠 수 없고, 생성 타입을
          // 넓히면 다른 호출부에서 진짜 Blob이 아닌 값이 조용히 통과한다. 그래서 여기서만 좁게 캐스팅한다.
          picture: toReactNativeFilePart(uri) as unknown as Blob,
          // 서버는 offset이 붙은 값을 400으로 거절하고 값 자체를 KST로 간주한다(utils/kstTimestamp.ts)
          takenAt: toKstTimestamp(takenAt),
        },
      });
    },
    [savePictureWithCharacter],
  );

  // 서버 URL을 못 쓸 때 그릴 로컬 에셋. 보상 종류별 캐릭터가 없으면 닫힌 보물로 받친다 —
  // 빈 화면이 되면 촬영 자체가 무의미하다.
  const fallbackImage = treasure.characterImage ?? treasure.closedIcon;

  const character = useMemo(
    // 아직 못 받았으면 보물 인덱스로 대신 채운다 — id는 서버로 가지 않고 화면 내부 식별에만
    // 쓰이므로(위 prop 주석) 서버 id가 아니어도 문제가 없다.
    () => ({ id: characterId ?? `treasure-${treasure.treasureIndex}`, name: characterName ?? null, imageUrl: characterImageUrl ?? null }),
    [characterId, characterName, characterImageUrl, treasure.treasureIndex],
  );

  return (
    <CharacterPhotoCapture
      character={character}
      fallbackImage={fallbackImage}
      onUpload={handleUpload}
      // 실패 로그를 예전과 같은 태그로 남긴다 — 기존 Sentry 검색이 그대로 살아 있어야 한다
      telemetryFeature="treasure-photo"
      renderHeader={({ onBack: onHeaderBack }) => <TreasureHeader onBack={onHeaderBack} />}
      // 진행도 카드는 보물을 찾는 중일 때만 그린다(showProgress prop 주석)
      cameraOverlay={
        showProgress ? (
          <TreasureProgressCard
            foundCount={foundCount}
            totalCount={totalCount}
            backgroundColor="rgba(0, 0, 0, 0.7)"
            style={[styles.progressCard, { top: insets.top + PROGRESS_CARD_TOP_OFFSET }]}
          />
        ) : undefined
      }
      onCaptured={onCaptured}
      onBack={onBack}
    />
  );
}
