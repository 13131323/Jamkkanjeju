import { File, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { parseImageDataUrl } from '@/services/imageDataUrl';

/**
 * web이 만든 이미지(data URL)를 기기 갤러리에 저장한다.
 *
 * 도감 카드의 저장 버튼이 유일한 호출부다 — 카드는 web이 그리므로 그림을 만들 수 있는 건 web뿐이고,
 * 갤러리 쓰기는 네이티브만 할 수 있다. 그래서 브릿지(`SAVE_IMAGE`)로 건너온 base64를 여기서 푼다.
 *
 * **결과를 던지지 않고 값으로 돌려준다.** 저장 실패는 예외 상황이 아니라 정상 흐름의 일부이고
 * (권한 거부, 저장 공간 부족), 호출부는 그때 안내 문구만 바꿔 띄우면 된다.
 */
export type SaveImageResult = 'saved' | 'permission-denied' | 'failed';

/**
 * data URL을 캐시에 파일로 쓴 뒤 갤러리에 넣는다.
 *
 * 캐시를 거치는 이유: `MediaLibrary`는 **파일 URI만** 받는다(data URL을 모른다).
 * 넣고 나면 그 임시 파일은 지운다 — 갤러리에는 이미 복사본이 있고, 남겨 두면 캐시에 쌓인다.
 */
export async function saveImageToGallery(dataUrl: string, fileName: string): Promise<SaveImageResult> {
  const parsed = parseImageDataUrl(dataUrl);
  if (parsed === null) return 'failed';

  // writeOnly(true): 저장만 하고 기존 앨범을 읽지 않으므로 최소 권한만 요청한다
  // (CharacterPhotoCapture의 촬영 저장과 같은 규칙)
  const permission = await MediaLibrary.requestPermissionsAsync(true);
  if (!permission.granted) return 'permission-denied';

  const file = new File(Paths.cache, `${fileName}.${parsed.extension}`);
  try {
    // 같은 이름이 남아 있으면 create가 실패한다 — 저장 버튼은 여러 번 눌릴 수 있다
    if (file.exists) file.delete();
    file.create();
    file.write(Uint8Array.from(atob(parsed.base64), (character) => character.charCodeAt(0)));

    await MediaLibrary.Asset.create(file.uri);
    return 'saved';
  } catch {
    return 'failed';
  } finally {
    try {
      if (file.exists) file.delete();
    } catch {
      // 정리 실패는 저장 성공을 뒤집지 않는다. 캐시는 OS가 언젠가 비운다
    }
  }
}
