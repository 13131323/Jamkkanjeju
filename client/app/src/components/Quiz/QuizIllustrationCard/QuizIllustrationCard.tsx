import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { SkeletonBlock } from '@/components/SkeletonBlock/SkeletonBlock';

interface QuizIllustrationCardProps {
  /** 서버가 문제마다 주는 이미지 URL */
  imageUri: string;
}

/**
 * 문제 이미지 카드.
 *
 * 초성 문제도 서버가 완성된 이미지를 주므로 화면에서 초성 타일을 얹지 않는다.
 * 이미지 종류마다 비율이 달라(초성 가로형 / 포스터 세로형) 상자에 맞춰 자르지 않고
 * contain으로 전체를 보여준 뒤 모서리만 둥글린다.
 */
const CARD_HEIGHT = 180;

/** 자리표시 색. 아래 실패 안내의 배경(bg-cool-neutral-100)과 같은 값이라 두 상태가 같은 톤으로 보인다 */
const SKELETON_COLOR = '#efefef';

type LoadStatus = 'loading' | 'loaded' | 'failed';

export function QuizIllustrationCard({ imageUri }: QuizIllustrationCardProps) {
  // 상태를 URL과 한 덩어리로 저장한다. culture.tsx가 이 카드에 key를 주지 않아 문제를 넘겨도
  // 같은 인스턴스가 재사용되는데, 상태만 따로 두면 Q1에서 실패한 결과가 Q2까지 남아 이미지가
  // 영구히 가려진다. 저장된 URL이 현재 prop과 다르면 곧 새 요청이 시작될 것이므로 loading으로 읽는다
  // (useEffect로 되돌리면 초기화가 커밋 뒤로 밀려 한 프레임 동안 이전 문제의 결과가 그대로 보인다).
  const [load, setLoad] = useState<{ uri: string; status: LoadStatus }>({ uri: imageUri, status: 'loading' });
  const status = load.uri === imageUri ? load.status : 'loading';

  return (
    <View className="overflow-hidden rounded-[20px]" style={{ height: CARD_HEIGHT }}>
      {status === 'failed' ? (
        // CDN이 죽어 있을 때 실사용자도 보게 되는 화면이라 경고처럼 보이지 않게 한 줄 안내만 둔다
        <View className="h-full w-full items-center justify-center bg-cool-neutral-100">
          <Text className="text-center font-pretendard-regular text-body-md text-cool-neutral-500">이미지를 불러올 수 없어요</Text>
        </View>
      ) : (
        <>
          <Image
            source={{ uri: imageUri }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="contain"
            onLoadStart={() => setLoad({ uri: imageUri, status: 'loading' })}
            onLoad={() => setLoad({ uri: imageUri, status: 'loaded' })}
            onError={() => setLoad({ uri: imageUri, status: 'failed' })}
          />
          {status === 'loading' ? (
            // 카드 높이를 그대로 유지해야 문제·보기 위치가 흔들리지 않아 이미지 위에 겹쳐 올린다.
            //
            // 가운데 스피너가 아니라 **카드를 통째로 덮는 자리표시**다. 곧 나타날 것이 이 상자를
            // 채우는 그림 한 장이라, 그림이 들어올 자리를 그대로 그리는 편이 "무엇을 기다리는지"를
            // 그대로 보여준다. 크기는 카드와 같은 CARD_HEIGHT · radius 20이라 어차피 튈 높이가 없다.
            // 색은 로딩 실패 안내가 쓰는 배경(cool-neutral-100)과 같은 값으로, 흰 카드 위에서 보인다.
            <View style={StyleSheet.absoluteFill}>
              <SkeletonBlock width="100%" height={CARD_HEIGHT} radius={20} color={SKELETON_COLOR} />
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}
