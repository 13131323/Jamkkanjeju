/**
 * 브릿지 메시지 계약은 @packages/shared 한 곳에만 둔다.
 * (예전에는 이 파일과 app/src/bridge/index.ts를 수동으로 동일하게 유지했다)
 *
 * 기존 import 경로(`@shared/lib/bridge`)를 그대로 쓸 수 있도록 re-export만 남긴다.
 * 송수신 구현은 플랫폼 API가 달라 같은 디렉터리의 utils.ts에 그대로 있다.
 */
export { LocationPermissionStatusSchema, WebToAppMessageSchema, AppToWebMessageSchema, WEB_TO_APP_MESSAGE_TYPES, APP_TO_WEB_MESSAGE_TYPES, TREASURE_INVALID_HEADING } from '@packages/shared';

export type { BridgeMessage, PingPayload, PongPayload, LocationPermissionStatus, WebToAppMessage, AppToWebMessage } from '@packages/shared';
