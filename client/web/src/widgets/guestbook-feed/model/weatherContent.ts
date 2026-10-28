export type WeatherContent = {
  condition: string; // "맑음" 등
  temperature: string; // "21°C" 등 — 백엔드가 필드를 분리해서 내려주기 전까지는 항상 빈 문자열
};

// contentWeather가 현재는 문자열 하나(예: "맑음")로만 내려온다.
// 백엔드가 condition/temperature를 분리해서 내려주기 시작하면 이 함수 내부만 교체하면 된다(02.md 4장).
export function parseWeatherContent(raw: string | null | undefined): WeatherContent | null {
  if (!raw) return null;
  return { condition: raw, temperature: '' };
}
