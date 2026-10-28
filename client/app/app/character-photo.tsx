import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CharacterPhotoCapture } from '@/components/CharacterPhotoCapture/CharacterPhotoCapture';
import { FullBleed } from '@/components/FullBleed/FullBleed';
import { NavigationHeader } from '@/components/NavigationHeader/NavigationHeader';
import { useGetMypageApiV1UsersMeMypageGet } from '@/services/api/mypage/mypage';
import { navigate } from '@/utils/navigate';

/**
 * 마이페이지 도감 캐릭터와 사진 찍기.
 *
 * 도감 화면은 web(WebView)에 있고 카메라는 네이티브만 열 수 있어서, web의 "함께 사진 찍기"가
 * 브릿지로 `CHARACTER_PHOTO`를 보내면 홈 WebView가 이 라우트를 연다
 * (`components/HomeWebView/useHomeBridge.ts`).
 *
 * ## 어떤 캐릭터를 합성하나
 * **web이 보낸 캐릭터**, 즉 도감에서 열어 놓고 "함께 사진 찍기"를 누른 그 캐릭터다(사용자 지시).
 * 다른 캐릭터를 열어 놓고 눌렀는데 대표 캐릭터가 나오면 누른 것과 다른 결과가 된다.
 *
 * 마이페이지의 대표 캐릭터(`profile.selectedArCharacter`)는 **폴백**이다. web이 값을 못 보낸
 * 경로(옛 web 빌드 등)에서도 화면이 비지 않도록 서버가 아는 캐릭터로 받친다.
 *
 * ## 왜 업로드가 없나
 * 서버에 이 사진을 받을 자리가 아직 없다. 보물찾기의 `pictures-with-character`는 그 미션 기록이라
 * 도감 사진을 거기 넣으면 미션 통계가 어긋난다. 그래서 지금은 **갤러리 저장까지만** 한다 —
 * `onUpload`를 넘기지 않으면 공용 컴포넌트가 전송 단계를 건너뛴다.
 */
export default function CharacterPhotoScreen() {
  const insets = useSafeAreaInsets();
  const { characterId, name, imageUrl } = useLocalSearchParams<{ characterId?: string; name?: string; imageUrl?: string }>();

  // 대표 캐릭터를 읽으려고 부른다. 마이페이지 화면(web)이 이미 같은 응답을 쓰지만 그건 WebView 쪽
  // 캐시라 여기서는 다시 묻는다 — 카메라를 여는 짧은 순간이라 한 번 더 물어도 부담이 없다.
  const { data: mypage } = useGetMypageApiV1UsersMeMypageGet();
  const selected = mypage?.profile?.selectedArCharacter ?? null;

  const leave = () => navigate.back();

  return (
    <FullBleed>
      <CharacterPhotoCapture
        // id는 서버로 가지 않는다 — 화면 내부 식별용이라 못 받았을 때의 대체값이면 충분하다
        character={{
          id: characterId ?? selected?.id ?? 'ar-character',
          name: name ?? selected?.name ?? null,
          imageUrl: imageUrl ?? selected?.imageUrl ?? null,
        }}
        // 로컬 폴백을 두지 않는다. 앱에는 도감 캐릭터 그림이 없어서 받칠 것이 없고,
        // 그림을 못 불러오면 캐릭터 레이어 없이 카메라만 그려진다(characterSource.ts).
        accent="character"
        telemetryFeature="ar-character-photo"
        // 보물찾기 촬영 화면과 같은 헤더 — 카메라 위에 얹히므로 배경 없이 동그란 뒤로가기만 둔다
        renderHeader={({ onBack }) => (
          <View style={{ paddingTop: insets.top }}>
            <NavigationHeader title="" onBack={onBack} backVariant="circle" />
          </View>
        )}
        // 저장을 마치면 왔던 도감 화면으로 돌아간다
        onCaptured={leave}
        onBack={leave}
      />
    </FullBleed>
  );
}
