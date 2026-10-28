// 걸음 수 목표는 서버가 내려주는 값이 아니라 화면이 제시하는 선택지라 여기 고정해둔다.
export const STEP_GOAL_PRESETS = [5000, 8000, 10000] as const;

export const STEP_GOAL_POINT_REWARD = 100;

// 직접 입력 시 최소값이자 기본값(사용자 요청).
export const MIN_STEP_GOAL = 1000;
