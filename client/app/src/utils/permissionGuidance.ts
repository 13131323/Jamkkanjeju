/**
 * 카메라 권한과 미디어 라이브러리 권한 요청 결과를 사용자 안내 문구로 변환하는 순수 함수.
 *
 * 두 권한은 요청 시점이 다르다(카메라는 화면 진입 시, 미디어 라이브러리는 저장 시점 —
 * docs/trouble/2026-08-15-treasure-hunt-tech-decisions.md §6) 이지만
 * "거부됨 → 안내 문구를 어떻게 보여줄지" 판단 로직 자체는 동일해서 하나로 뽑아 재사용한다.
 *
 * expo의 PermissionResponse를 그대로 받지 않고 필요한 필드만 뽑은 이유:
 * RN 네이티브 모듈 타입을 import하면 이 파일이 vitest(순수 node 환경)에서
 * react-native 의존성을 끌어오게 되어 테스트가 무거워진다.
 */
export interface PermissionRequestResult {
  granted: boolean;
  /** true면 시스템 권한 다이얼로그를 다시 띄울 수 있다. false면 OS가 재요청을 막아 설정 앱으로 보내야 한다 */
  canAskAgain: boolean;
}

export type PermissionGuidance = { blocked: false } | { blocked: true; message: string; canOpenSettings: boolean };

/**
 * @param result 권한 요청/조회 결과. 아직 확인 전이면 null.
 * @param subject 안내 문구에 들어갈 권한 이름 (예: "카메라", "사진 저장")
 */
export function resolvePermissionGuidance(result: PermissionRequestResult | null, subject: string): PermissionGuidance {
  // null은 "아직 확인 전"이다. 거부로 단정해 안내를 띄우면 첫 진입마다 깜빡이므로 통과시킨다.
  if (!result || result.granted) {
    return { blocked: false };
  }

  if (result.canAskAgain) {
    return {
      blocked: true,
      message: `${subject} 권한을 허용해야 계속할 수 있어요.`,
      canOpenSettings: false,
    };
  }

  return {
    blocked: true,
    message: `${subject} 권한이 거부되어 있어요. 설정에서 허용해주세요.`,
    canOpenSettings: true,
  };
}
