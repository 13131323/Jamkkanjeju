/**
 * TourAPI(관광공사) 대표 이미지 등 외부 이미지 URL이 http로 내려올 때가 있다. web이 http로 뜨는
 * 로컬 dev(`pnpm dev:app`)에서는 문제없이 보이지만, 실기기 APK는 web을 https(운영 배포 주소)로
 * 띄우기 때문에 그 안에서 http 이미지는 Mixed Content로 차단돼 회색/깨진 이미지로 보인다.
 */
export function toHttpsImageUrl(url: string): string {
  return url.startsWith('http://') ? `https://${url.slice('http://'.length)}` : url;
}
