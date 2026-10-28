import { useCallback, useEffect, useRef, useState } from 'react';
import WebView from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import { initTraceId, listenFromWeb, sendToWeb } from '@/bridge/utils';
import { resolveWebViewUrl } from '@/config/webUrl';
import { NetworkErrorScreen } from '@/components/NetworkErrorScreen/NetworkErrorScreen';
import { reissueWebViewAuth } from '@/components/HomeWebView/reissueWebViewAuth';
import { buildWebViewBootstrapScript } from '@/components/HomeWebView/webViewBootstrapScript';
import { INVALID_HEADING } from '@/hooks/useTreasureLocation';
import type { Coords } from '@/utils/geo';
import { shouldSendForHeading, shouldSendForPosition } from './throttle';

/** web이 보물찾기 지도 모드로 분기하는 경로. docs/trouble/2026-08-15-treasure-hunt-tech-decisions.md §4 "미결 사항" */
export const DEFAULT_TREASURE_MAP_PATH = '/map?mode=treasure';

/** web 지도에 그릴 보물 마커 하나 */
export interface TreasureMapMarker {
  /** 서버가 매긴 보물 번호. 마커 배지의 "N번째"와 브릿지 식별자가 같은 값이다 */
  treasureIndex: number;
  coords: Coords;
  /** 이미 찾은 보물은 열린 에셋으로 그린다 */
  found: boolean;
}

export type TreasureHuntMapProps = {
  /** WebView가 열 web 경로. 기본값 '/map?mode=treasure' */
  path?: string;
  /** 현재 위치. null이면 마커를 보내지 않는다 */
  coords: Coords | null;
  /** 스무딩된 trueHeading. 무효값은 INVALID_HEADING */
  heading: number;
  /** 지도에 그릴 보물 마커. prompt §9 "보물 아이콘을 감싸는 원에 있는 숫자" */
  markers: TreasureMapMarker[];
  /** 지도 초기 중심(장소 좌표). 첫 마커 메시지에서 한 번만 쓰인다 */
  center?: Coords | null;
  /**
   * 지도에서 보물 마커를 눌렀을 때. 인자는 서버 보물 번호(treasureIndex).
   *
   * step1 시트를 끌어내려 닫은 뒤 다시 열 수 있어야 해서 web이 탭을 브릿지로 넘겨준다.
   */
  onTreasurePress?: (treasureIndex: number) => void;
};

type TreasureLocationPayload = {
  latitude: number;
  longitude: number;
  heading: number;
  timestamp: number;
};

/**
 * step0 지도. web(`/map?mode=treasure`)을 WebView로 재사용하고 위치·보물 좌표만 브릿지로 흘린다
 * (docs/trouble/2026-08-15-treasure-hunt-tech-decisions.md §4).
 *
 * 화면 위에 얹히는 헤더·진행도·토스트·시트는 상위 화면(app/mission/treasure.tsx)이 그린다 —
 * 이 컴포넌트는 지도와 브릿지만 맡는다.
 */
export function TreasureHuntMap({ path = DEFAULT_TREASURE_MAP_PATH, coords, heading, markers, center = null, onTreasurePress }: TreasureHuntMapProps) {
  const webViewRef = useRef<WebView>(null);
  const [hasLoadError, setHasLoadError] = useState(false);
  /** web이 PING을 보내 traceId가 잡히기 전에는 어떤 메시지도 전달되지 않는다 */
  const [isBridgeReady, setIsBridgeReady] = useState(false);

  const lastSentAtRef = useRef<number | null>(null);
  const lastSentHeadingRef = useRef<number | null>(null);

  const sendLocation = useCallback((payload: TreasureLocationPayload) => {
    lastSentAtRef.current = Date.now();
    lastSentHeadingRef.current = payload.heading;
    sendToWeb(webViewRef, { type: 'TREASURE_LOCATION_UPDATE', payload });
  }, []);

  // 위치·heading이 갱신되면 throttle 규칙에 맞을 때만 흘려보낸다.
  // 핸드셰이크(PING) 이전에는 isBridgeReady가 false라 아무것도 나가지 않고,
  // ready가 되는 순간 이 effect가 다시 돌면서 최신 좌표가 곧바로 전달된다
  // (문서 §4 "핸드셰이크 순서" 함정).
  useEffect(() => {
    if (!isBridgeReady || !coords) return;

    const payload: TreasureLocationPayload = {
      latitude: coords.latitude,
      longitude: coords.longitude,
      heading: Number.isFinite(heading) ? heading : INVALID_HEADING,
      timestamp: Date.now(),
    };

    const isFirstSend = lastSentAtRef.current === null;
    if (isFirstSend || shouldSendForPosition(Date.now(), lastSentAtRef.current) || shouldSendForHeading(payload.heading, lastSentHeadingRef.current)) {
      sendLocation(payload);
    }
  }, [isBridgeReady, coords, heading, sendLocation]);

  // 보물 마커는 개수가 적고 "찾음" 상태가 바뀔 때만 갱신되므로 throttle 없이 그대로 보낸다
  useEffect(() => {
    if (!isBridgeReady) return;

    sendToWeb(webViewRef, {
      type: 'TREASURE_MARKERS_UPDATE',
      payload: {
        center: center ? { latitude: center.latitude, longitude: center.longitude } : null,
        treasures: markers.map((marker) => ({
          // 브릿지 스키마(packages/shared/src/bridge)의 treasureId는 문자열이고 web이 마커 재사용 키로
          // 쓰고 있다. 앱 쪽 식별자가 서버의 숫자 treasureIndex로 바뀌었지만, 전송 규약을 바꾸면
          // web을 함께 고쳐야 하므로 같은 값을 문자열로 실어 보낸다.
          treasureId: String(marker.treasureIndex),
          order: marker.treasureIndex,
          latitude: marker.coords.latitude,
          longitude: marker.coords.longitude,
          found: marker.found,
        })),
      },
    });
  }, [isBridgeReady, markers, center]);

  // JSX prop에 인라인으로 두면 Date.now()·ref 접근이 렌더 스코프로 잡혀 react-hooks 규칙에 걸린다.
  // 실제로 호출되는 시점은 web이 메시지를 보낸 뒤(=이벤트)이므로 useCallback으로 빼낸다.
  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      listenFromWeb((msg) => {
        // 보물 마커 탭 — 끌어내려 닫은 step1 시트를 다시 올리는 유일한 경로다
        if (msg.type === 'TREASURE_MARKER_PRESS') {
          onTreasurePress?.(msg.payload.treasureIndex);
          return;
        }
        // 이 화면이 여는 /map?mode=treasure도 GET /api/v1/map/contents를 부르고 그 API는 401을 낸다.
        // 다른 WebView 5곳에는 이 갈래가 있었는데 여기만 빠져 있었다(같은 문서 §D).
        if (msg.type === 'AUTH_TOKEN_REQUEST') {
          void reissueWebViewAuth(webViewRef);
          return;
        }
        if (msg.type !== 'PING') return;

        initTraceId(msg.traceId);
        sendToWeb(webViewRef, { type: 'PONG', payload: { timestamp: Date.now() } });
        // storedTraceId가 이제 막 세팅됐으므로, 보관 중인 최신 위치·마커를 흘려보낸다
        setIsBridgeReady(true);
      })(event);
    },
    [onTreasurePress],
  );

  if (hasLoadError) {
    return <NetworkErrorScreen onRetry={() => setHasLoadError(false)} />;
  }

  return (
    <WebView
      ref={webViewRef}
      source={{
        uri: resolveWebViewUrl(process.env.EXPO_PUBLIC_WEB_URL, __DEV__, path, process.env.EXPO_PUBLIC_DEV_WEB_URL),
      }}
      style={{ flex: 1 }}
      onError={() => setHasLoadError(true)}
      onMessage={handleMessage}
      // 토큰·앱 정보를 문서 실행 전에 심는다. 이 화면은 보물 마커만 브릿지로 받으므로
      // 토큰이 빠져 있어도 눈에 잘 띄지 않았지만, 배경 지도 콘텐츠는 계속 401이었다.
      injectedJavaScriptBeforeContentLoaded={buildWebViewBootstrapScript()}
    />
  );
}
