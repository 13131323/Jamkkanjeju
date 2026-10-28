// Kakao Maps JS SDK 최소 타입 선언 (Phase 1~2에서 실제로 쓰는 API만 선언)
declare namespace kakao {
  namespace maps {
    class LatLng {
      constructor(lat: number, lng: number);
      getLat(): number;
      getLng(): number;
    }

    class LatLngBounds {
      constructor(sw: LatLng, ne: LatLng);
      getSouthWest(): LatLng;
      getNorthEast(): LatLng;
    }

    interface MapOptions {
      center: LatLng;
      level?: number;
    }

    class Map {
      constructor(container: HTMLElement, options: MapOptions);
      setCenter(latlng: LatLng): void;
      getCenter(): LatLng;
      panTo(latlng: LatLng): void;
      setLevel(level: number): void;
      getLevel(): number;
      getBounds(): LatLngBounds;
    }

    interface MarkerOptions {
      position: LatLng;
      map?: Map;
    }

    class Marker {
      constructor(options: MarkerOptions);
      getPosition(): LatLng;
      setPosition(latlng: LatLng): void;
      setMap(map: Map | null): void;
    }

    interface CustomOverlayOptions {
      position: LatLng;
      content: string | HTMLElement;
      map?: Map;
      xAnchor?: number;
      yAnchor?: number;
      zIndex?: number;
    }

    class CustomOverlay {
      constructor(options: CustomOverlayOptions);
      getPosition(): LatLng;
      setPosition(latlng: LatLng): void;
      setContent(content: string | HTMLElement): void;
      setMap(map: Map | null): void;
    }

    namespace event {
      function addListener(target: Map | Marker, type: string, handler: (...args: never[]) => void): void;
      function removeListener(target: Map | Marker, type: string, handler: (...args: never[]) => void): void;
    }

    namespace services {
      type Status = 'OK' | 'ZERO_RESULT' | 'ERROR';

      interface RegionAddress {
        address_name: string;
      }

      interface RoadAddress {
        address_name: string;
      }

      interface Coord2AddressResult {
        address: RegionAddress | null;
        road_address: RoadAddress | null;
      }

      /**
       * addressSearch 결과 한 건. x=경도, y=위도이고 **문자열**로 온다(SDK 응답이 그렇다) —
       * 숫자로 바꿔 쓰는 쪽이 파싱을 책임진다.
       */
      interface AddressSearchResult {
        address_name: string;
        x: string;
        y: string;
      }

      class Geocoder {
        coord2Address(x: number, y: number, callback: (result: Coord2AddressResult[], status: Status) => void): void;
        addressSearch(address: string, callback: (result: AddressSearchResult[], status: Status) => void): void;
      }
    }

    function load(callback: () => void): void;
  }
}

interface Window {
  kakao: typeof kakao;
}
