import { File, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { imageExtensionFromUrl, parseImageDataUrl } from '@/services/imageDataUrl';

/**
 * 이미지를 기기 갤러리에 저장한다. 갤러리 쓰기는 네이티브만 할 수 있어서 web이 여기로 넘긴다.
 *
 * **그림을 받는 방법이 둘이다**(브릿지 `SAVE_IMAGE` 계약, packages/shared/src/bridge/index.ts).
 *   - `dataUrl` — AR 도감 카드. 여러 DOM 요소를 합성한 그림이라 web이 PNG로 떠야만 존재한다.
 *   - `imageUrl` — AI 엽서. 서버가 이미 만들어 둔 한 장이라 **앱이 그 주소에서 곧장 내려받는다.**
 *     web이 `fetch`로 받아 넘기던 때는 이미지 호스트의 CORS에 막혀 저장이 통째로 실패했다
 *     (`<img>`로 보이기는 하는데 바이트는 못 읽었다). 네이티브 다운로드에는 그 제약이 없고,
 *     수 MB base64 문자열을 브릿지로 실어 나르지 않아도 된다.
 *
 * **결과를 던지지 않고 값으로 돌려준다.** 저장 실패는 예외 상황이 아니라 정상 흐름의 일부이고
 * (권한 거부, 저장 공간 부족), 호출부는 그때 안내 문구만 바꿔 띄우면 된다.
 */
export type SaveImageResult = 'saved' | 'permission-denied' | 'failed';

/** 둘 중 하나만 온다. 계약상 둘 다 optional이라 "아무것도 없음"은 여기서 failed로 떨어진다 */
export type SaveImageSource = { dataUrl?: string; imageUrl?: string };

/**
 * 그림을 캐시에 파일로 만든 뒤 갤러리에 넣는다.
 *
 * 캐시를 거치는 이유: `MediaLibrary`는 **파일 URI만** 받는다(data URL도, 원격 주소도 모른다).
 * 넣고 나면 그 임시 파일은 지운다 — 갤러리에는 이미 복사본이 있고, 남겨 두면 캐시에 쌓인다.
 */
export async function saveImageToGallery(source: SaveImageSource, fileName: string): Promise<SaveImageResult> {
  const parsed = source.dataUrl === undefined ? null : parseImageDataUrl(source.dataUrl);
  // data URL을 줬는데 형식이 깨졌으면 여기서 끝낸다 — 원격 주소로 되돌려 볼 일이 아니다
  if (source.dataUrl !== undefined && parsed === null) return 'failed';
  if (parsed === null && source.imageUrl === undefined) return 'failed';

  // writeOnly(true): 저장만 하고 기존 앨범을 읽지 않으므로 최소 권한만 요청한다
  // (CharacterPhotoCapture의 촬영 저장과 같은 규칙)
  const permission = await MediaLibrary.requestPermissionsAsync(true);
  if (!permission.granted) return 'permission-denied';

  const extension = parsed === null ? imageExtensionFromUrl(source.imageUrl as string) : parsed.extension;
  const file = new File(Paths.cache, `${fileName}.${extension}`);
  try {
    // 같은 이름이 남아 있으면 create가 실패한다 — 저장 버튼은 여러 번 눌릴 수 있다
    if (file.exists) file.delete();

    if (parsed === null) {
      // 원격 주소는 네이티브가 직접 받는다. create를 먼저 하지 않는다 —
      // downloadFileAsync가 목적지 파일을 스스로 만든다(이미 있으면 실패한다)
      await File.downloadFileAsync(source.imageUrl as string, file);
      await MediaLibrary.Asset.create(file.uri);
      return 'saved';
    }

    file.create();
    // base64 본문을 JS에서 바이트로 풀지 않는다. 예전에는
    // `Uint8Array.from(atob(base64), c => c.charCodeAt(0))`로 한 글자씩 콜백을 태웠는데,
    // 도감 카드 PNG(수백 KB, packages/shared/src/bridge/index.ts SAVE_IMAGE 주석 참고)도
    // base64로는 그 1.3배 글자 수라 콜백이 수십만 번 도는 구간이었다 — 저장 버튼을 누른 뒤
    // 체감 지연의 대부분이 여기서 났다. `encoding: 'base64'`를 주면 디코딩이 네이티브
    // (Android Base64.decode / iOS Data(base64Encoded:))로 넘어가 이 구간이 사라진다.
    file.write(parsed.base64, { encoding: 'base64' });

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
