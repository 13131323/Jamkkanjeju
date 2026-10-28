import { create } from 'zustand';
import type { LocationPermissionStatus } from '@shared/lib/bridge';
import type { Coordinates } from '@shared/config/geo';

export type LocationCoords = {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
};

type LocationState = {
  permissionStatus: LocationPermissionStatus;
  coords: LocationCoords | null;
  manualCoords: Coordinates | null;
  setPermissionStatus: (status: LocationPermissionStatus) => void;
  setCoords: (coords: LocationCoords | null) => void;
  setManualCoords: (coords: Coordinates | null) => void;
};

// 초기 상태는 "아직 아무것도 모르는" 값이다 — 앱이 LOCATION_PERMISSION_RESULT/LOCATION_UPDATE로 채운다.
// 좌표를 미리 넣어두면 권한을 거부한 사용자에게도 그 좌표에 마커가 떠 있다.
export const useLocationStore = create<LocationState>((set) => ({
  permissionStatus: 'undetermined',
  coords: null,
  manualCoords: null,
  setPermissionStatus: (status) => set({ permissionStatus: status }),
  setCoords: (coords) => set({ coords }),
  setManualCoords: (coords) => set({ manualCoords: coords }),
}));
