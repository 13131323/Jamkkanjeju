import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/Button/Button';
import { InviteSheetBackdrop } from '@/components/Coop/InviteSheetBackdrop/InviteSheetBackdrop';
import { FullBleed } from '@/components/FullBleed/FullBleed';
import { NavigationHeader } from '@/components/NavigationHeader/NavigationHeader';
import { COOP_BACKGROUND_COLORS, COOP_CIRCLE_COLORS, COOP_CTA_SCRIM_COLORS, coopStepStyles as styles } from '@/styles/coopStep';
import { ctaBottomPadding } from '@/styles/safeArea';

interface CoopStepLayoutProps {
  /** 타이틀 존의 알약 배지("일행 초대" / "역할 배정" / "재료 찾기") */
  badge: string;
  title: string;
  subtitle: string;
  /** 뒤로가기. 진행 중 단계는 이탈 확인 모달을 띄우는 함수를 넘긴다 */
  onBack: () => void;
  ctaText: string;
  ctaDisabled?: boolean;
  onCtaPress: () => void;
  /**
   * 시트 윗변을 기울어진 두 판이 아니라 **일자**로 그린다.
   *
   * 초대 화면만 Penpot에 기울어진 판이 있고, 재료 찾기 시안(assets/images/1.png)의 경계는
   * 수평 직선이다. 두 화면이 같은 골격을 쓰되 이 한 가지만 다르다.
   */
  flatTop?: boolean;
  /** 흰 시트 안에 들어가는 내용. 스크롤 여부는 화면이 정한다 */
  children: ReactNode;
}

/**
 * 협동 미션 단계 화면(step1·step2·step3) 공통 골격.
 *
 * 세 보드가 배경·장식 원·헤더·타이틀 존·기울어진 흰 시트·CTA까지 동일하고 시트 내용만 다르다.
 * 화면마다 이 골격을 다시 조립하면 값이 세 곳에서 갈라지므로 여기 한 곳에 둔다.
 *
 * CTA 색은 디자인이 세 단계 모두 #333333(cool-neutral)이다 — 협동 오렌지가 아니다.
 */
export function CoopStepLayout({ badge, title, subtitle, onBack, ctaText, ctaDisabled = false, onCtaPress, flatTop = false, children }: CoopStepLayoutProps) {
  const insets = useSafeAreaInsets();

  return (
    // 배경 그라디언트와 장식 원이 시스템 바 뒤까지 이어져야 해서 루트 padding을 취소한다
    <FullBleed>
      <View style={styles.screen}>
        <LinearGradient colors={COOP_BACKGROUND_COLORS} style={styles.background} />
        <LinearGradient colors={COOP_CIRCLE_COLORS} style={styles.circle} />

        <View style={{ paddingTop: insets.top }}>
          {/* 디자인 Header에는 뒤로가기 화살표만 있고 제목이 없다 */}
          <NavigationHeader title="" onBack={onBack} />
        </View>

        <View style={styles.titleZone}>
          <View style={styles.stepBadge}>
            <Text style={styles.stepBadgeText}>{badge}</Text>
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>

        <View style={[styles.sheet, flatTop && styles.sheetFlat]}>
          {!flatTop && <InviteSheetBackdrop />}

          {children}

          <View style={[styles.ctaWrapper, { paddingBottom: ctaBottomPadding(insets.bottom) }]}>
            <LinearGradient colors={COOP_CTA_SCRIM_COLORS} locations={[0, 0.4]} style={styles.ctaScrim} />
            <Button color="cool-neutral" bold text={ctaText} disabled={ctaDisabled} onPress={onCtaPress} />
          </View>
        </View>
      </View>
    </FullBleed>
  );
}
