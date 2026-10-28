import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { DashedRect } from '@/components/Coop/DashedBorder/DashedBorder';
import { SkeletonBlock } from '@/components/SkeletonBlock/SkeletonBlock';
import { useSinglePress } from '@/hooks/useSinglePress';
import { resolvePhotoUri } from './photoUri';

/** Penpot Upload-Button 안의 camera-off 아이콘(24x24, #888888) */
function CameraOffIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M2 2l20 20M7 7H4a2 2 0 00-2 2v9a2 2 0 002 2h16M9.5 4h5L17 7h3a2 2 0 012 2v7.5M14.12 15.12A3 3 0 119.88 10.88"
        stroke="#888888"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * Penpot `촬영 완료 상태` > Upload-Button > 다시 촬영 버튼 > cam-icon (14x14, #ffffff).
 *
 * Penpot의 stroke alignment가 `inner`(도형 안쪽에만 그림)인데 SVG stroke는 중앙 정렬이라,
 * 각 도형을 선 두께의 절반(0.6)만큼 안으로 줄이고 radius도 같은 값을 빼야 픽셀이 맞는다.
 */
function CamIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
      <Rect x={5.35} y={3.1} width={3.3} height={0.8} rx={0.2} stroke="#ffffff" strokeWidth={1.2} />
      <Rect x={2.1} y={4.6} width={9.8} height={6.8} rx={0.9} stroke="#ffffff" strokeWidth={1.2} />
      <Circle cx={7} cy={8} r={1.4} stroke="#ffffff" strokeWidth={1.2} />
    </Svg>
  );
}

/** Penpot Upload-Button 높이. SVG 점선은 퍼센트 높이를 못 받아 숫자로 고정한다 */
const UPLOAD_HEIGHT = 80;

interface RoleVerifyProps {
  /**
   * 업로드 박스 위 안내 문구.
   *
   * 예전 계약의 `roleCards[].hint`였는데 서버가 그 필드를 없앴다. 지금은 역할명으로
   * 만들어 넣는다(`roleVerifyHint`) — 문구가 사라지면 무엇을 찍어야 하는지 알 수 없다.
   */
  hint: string;
  /**
   * 인증한 사진. 없으면 업로드 안내를 그린다.
   *
   * **아직 올리지 않은 팀원이 정상 상태다** — 남의 사진은 2초 폴링으로만 따라오므로,
   * 그 사람이 촬영하기 전에는 서버가 `itemImgUrl`을 비워 보낸다(계약상 `string | null`).
   */
  photoUri?: string;
  /** 내 역할에서만 전달한다. 없으면 팀원의 인증 사진을 조회만 한다 */
  onPressUpload?: () => void;
}

/**
 * 내 역할의 사진 인증 영역(step3).
 *
 * Penpot `탐라로그 V2 / 인증상태` — 안내 문구 한 줄과 점선 업로드 박스로 이뤄진다.
 * 인증 상태 알약은 이 영역이 아니라 카드 헤더에 있다(RoleCard의 status).
 *
 * 업로드된 사진을 보여주는 상태는 디자인에 없다. 같은 박스 자리에 사진을 채워
 * 무엇을 올렸는지 확인할 수 있게 했다 — 올린 뒤 화면에 변화가 없으면 인증됐는지 알 수 없다.
 */
export function RoleVerify({ hint, photoUri: rawPhotoUri, onPressUpload }: RoleVerifyProps) {
  const handlePress = useSinglePress(onPressUpload);

  const photoUri = resolvePhotoUri(rawPhotoUri);

  /**
   * 사진이 실제로 그려졌는지 / 못 불러왔는지.
   *
   * **URI 자체를 담는다**(boolean이 아니라). 같은 카드에서 다시 촬영하면 URI가 바뀌는데,
   * boolean이면 앞 사진의 결과가 남아 새 사진이 뜨기도 전에 "다 불러왔다"로 읽힌다.
   * URI를 비교하면 값이 바뀌는 순간 자동으로 로딩 상태로 되돌아가 effect가 필요 없다.
   */
  const [loadedUri, setLoadedUri] = useState<string | null>(null);
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const isPhotoReady = photoUri !== undefined && loadedUri === photoUri;
  const hasPhotoFailed = photoUri !== undefined && failedUri === photoUri;

  const contents =
    photoUri === undefined ? (
      <>
        {/* 점선 테두리는 radius와 함께 쓸 수 없어 SVG로 그린다(DashedBorder 참고) */}
        <DashedRect color="#dddddd" radius={12} height={UPLOAD_HEIGHT} />
        <CameraOffIcon />
        {/* Penpot 문구는 "사진 업로드"였는데 사용자 지시로 "사진 촬영" — 이 자리는 실제로 카메라를 연다 */}
        <Text style={styles.uploadLabel}>{onPressUpload === undefined ? '인증 사진 없음' : '사진 촬영'}</Text>
      </>
    ) : (
      <>
        {/*
          사진이 뜨기 전과 **영영 못 뜰 때**의 자리표시(사용자 지시).

          서버가 준 주소가 죽어 있거나 네트워크가 느리면 이 자리가 흰 박스로 남아, 사진을 올리지
          않은 것과 구분되지 않았다. 스켈레톤을 깔아 두면 "사진이 들어갈 자리"라는 것이 보인다.

          실패했으면 깜빡임을 멈춘다 — 계속 반짝이면 영원히 불러오는 중인 것처럼 보인다
          (SkeletonBlock의 pulse 주석). 흰 박스 위라 색은 회색 계열이어야 보인다.
        */}
        {!isPhotoReady && <SkeletonBlock width="100%" height={UPLOAD_HEIGHT} radius={12} color="#f6f5f4" pulse={!hasPhotoFailed} style={styles.photoSkeleton} />}

        {/* 실패한 주소는 다시 그리지 않는다 — 같은 요청을 반복해도 결과가 같고, 그동안 빈 이미지가
            스켈레톤 위를 덮는다 */}
        {!hasPhotoFailed && (
          <Image
            source={{ uri: photoUri }}
            style={styles.photo}
            resizeMode="cover"
            onLoad={() => setLoadedUri(photoUri)}
            onError={() => setFailedUri(photoUri)}
          />
        )}
      </>
    );

  return (
    <View style={styles.root}>
      <Text style={styles.hint}>{hint}</Text>

      {onPressUpload === undefined ? (
        <View style={styles.uploadBox} accessibilityLabel="인증 사진 조회">
          {contents}
        </View>
      ) : (
        <Pressable onPress={handlePress} style={styles.uploadBox} accessibilityLabel="사진 촬영">
          {contents}

          {/* 사진을 올린 뒤에는 박스 전체가 사진이라 다시 찍을 방법이 보이지 않는다.
              Penpot `촬영 완료 상태`의 우하단 버튼이 그 경로다. 박스 자체도 눌리므로
              이 버튼은 안내 역할이고, 눌러도 같은 촬영 화면이 열린다. */}
          {photoUri !== undefined && (
            <View style={styles.retakeButton} pointerEvents="none">
              <Text style={styles.retakeLabel}>다시 촬영</Text>
              <CamIcon />
            </View>
          )}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // 인증상태: 안내 문구 → 8 → 업로드 박스
  root: { gap: 8 },
  hint: {
    color: '#463f36',
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 14,
    lineHeight: 20,
  },
  // Upload-Button 288x80, 흰 배경 + 점선 #dddddd + radius 12
  uploadBox: {
    height: UPLOAD_HEIGHT,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  uploadLabel: {
    color: '#888888',
    fontFamily: 'Pretendard-Regular',
    fontSize: 10,
    lineHeight: 13,
  },
  photo: { width: '100%', height: '100%' },
  // 사진과 **정확히 같은 자리**를 덮는다. 박스가 가운데 정렬이라 절대배치가 아니면
  // 스켈레톤과 사진이 나란히 놓여 박스가 두 배로 늘어난다
  photoSkeleton: { position: 'absolute', left: 0, top: 0 },
  /**
   * 다시 촬영 버튼: 우하단 8/8, radius 6, 검정 60%.
   *
   * 폭을 79로 고정하지 않는다 — Penpot에서 `horizontalSizing: "auto"`라 라벨 길이에 따라
   * 늘어나는 값이고, 고정하면 문구를 바꿀 때 글자가 잘린다. 패딩 10/10 + gap 4가 디자인 값이다.
   * 아이콘이 라벨 왼쪽에 오도록 `row-reverse`를 쓴 것도 디자인 그대로다.
   */
  retakeButton: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    height: 28,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  retakeLabel: {
    color: '#ffffff',
    fontFamily: 'Pretendard-Medium',
    fontSize: 11,
    lineHeight: 14,
  },
});
