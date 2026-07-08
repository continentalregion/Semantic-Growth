import React, { useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
  createAnimatedComponent,
  FadeInDown,
} from "react-native-reanimated";
import Svg, {
  Path,
  Circle,
  Defs,
  ClipPath,
  Rect as SvgRect,
} from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useTranslation } from "react-i18next";
import { router } from "expo-router";
import {
  useGetPredictions,
  useGetMyProfile,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { palette } from "@/constants/theme";
import { usePurchase } from "@/hooks/usePurchase";
import { AnimatedScreen } from "@/components/ui/AnimatedScreen";
import { SkeletonBox } from "@/components/ui/SkeletonBox";

const AnimatedRect = createAnimatedComponent(SvgRect);

const CONSERVATIVE_COLOR = palette.primary;
const OPTIMISTIC_COLOR = palette.teal;

type ScenarioKey = "conservative" | "realistic" | "optimistic";

interface ScenarioData {
  sgi30d: number;
  sgi90d: number;
  sgi180d: number;
  rank30d: number;
  rank90d: number;
  rank180d: number;
}

function buildPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return "";
  const smooth = (
    p1: { x: number; y: number },
    p2: { x: number; y: number }
  ) => {
    const cpX = (p1.x + p2.x) / 2;
    return `C ${cpX} ${p1.y} ${cpX} ${p2.y} ${p2.x} ${p2.y}`;
  };
  return (
    `M ${pts[0].x} ${pts[0].y}` +
    pts.slice(1).map((p, i) => smooth(pts[i], p)).join(" ")
  );
}

function PredictionChart({
  currentScore,
  predictions,
  colors,
  chartWidth,
  t,
}: {
  currentScore: number;
  predictions: {
    conservative: ScenarioData;
    realistic: ScenarioData;
    optimistic: ScenarioData;
  };
  colors: ReturnType<typeof useColors>;
  chartWidth: number;
  t: (key: string) => string;
}) {
  const H = 150;
  const PAD_X = 8;
  const PAD_Y = 14;
  const W = chartWidth;

  const scenarios = {
    conservative: [
      currentScore,
      predictions.conservative.sgi30d,
      predictions.conservative.sgi90d,
      predictions.conservative.sgi180d,
    ],
    realistic: [
      currentScore,
      predictions.realistic.sgi30d,
      predictions.realistic.sgi90d,
      predictions.realistic.sgi180d,
    ],
    optimistic: [
      currentScore,
      predictions.optimistic.sgi30d,
      predictions.optimistic.sgi90d,
      predictions.optimistic.sgi180d,
    ],
  };

  const allValues = [
    ...scenarios.conservative,
    ...scenarios.realistic,
    ...scenarios.optimistic,
  ];
  const minV = Math.min(...allValues);
  const maxV = Math.max(...allValues);
  const range = maxV - minV || 1;

  const toY = (v: number) =>
    PAD_Y + (1 - (v - minV) / range) * (H - PAD_Y * 2);
  const toX = (i: number) => PAD_X + (i / 3) * (W - PAD_X * 2);

  const makePts = (vals: number[]) =>
    vals.map((v, i) => ({ x: toX(i), y: toY(v) }));

  const cPts = makePts(scenarios.conservative);
  const rPts = makePts(scenarios.realistic);
  const oPts = makePts(scenarios.optimistic);

  const revealPct = useSharedValue(0);
  useEffect(() => {
    revealPct.value = withTiming(100, {
      duration: 1400,
      easing: Easing.out(Easing.cubic),
    });
  }, []);

  const animRectProps = useAnimatedProps(() => ({
    width: (revealPct.value / 100) * W,
  }));

  const xLabels = [t("predictions.now"), "30d", "90d", "180d"];

  const legendItems: { color: string; key: ScenarioKey }[] = [
    { color: CONSERVATIVE_COLOR, key: "conservative" },
    { color: palette.primary, key: "realistic" },
    { color: OPTIMISTIC_COLOR, key: "optimistic" },
  ];

  return (
    <View>
      <Svg width={W} height={H}>
        <Defs>
          <ClipPath id="predReveal">
            <AnimatedRect x={0} y={0} height={H} animatedProps={animRectProps} />
          </ClipPath>
        </Defs>

        {[1, 2, 3].map((i) => (
          <Path
            key={i}
            d={`M ${toX(i)} 0 L ${toX(i)} ${H}`}
            stroke="rgba(255,255,255,0.05)"
            strokeWidth={1}
          />
        ))}

        <Path
          d={buildPath(cPts)}
          stroke={CONSERVATIVE_COLOR}
          strokeWidth={2}
          fill="none"
          strokeDasharray="5 3"
          strokeLinecap="round"
          clipPath="url(#predReveal)"
        />
        <Path
          d={buildPath(oPts)}
          stroke={OPTIMISTIC_COLOR}
          strokeWidth={2}
          fill="none"
          strokeDasharray="5 3"
          strokeLinecap="round"
          clipPath="url(#predReveal)"
        />
        <Path
          d={buildPath(rPts)}
          stroke={palette.primary}
          strokeWidth={3}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          clipPath="url(#predReveal)"
        />

        {rPts.map((pt, i) => (
          <React.Fragment key={i}>
            <Circle cx={pt.x} cy={pt.y} r={5} fill={palette.primary} opacity={0.25} />
            <Circle cx={pt.x} cy={pt.y} r={3} fill={palette.primary} />
          </React.Fragment>
        ))}
      </Svg>

      <View style={st.xLabels}>
        {xLabels.map((label) => (
          <Text key={label} style={[st.xLabel, { color: colors.mutedForeground }]}>
            {label}
          </Text>
        ))}
      </View>

      <View style={st.legend}>
        {legendItems.map((item) => (
          <View key={item.key} style={st.legendItem}>
            <View style={[st.legendDot, { backgroundColor: item.color }]} />
            <Text style={[st.legendText, { color: colors.mutedForeground }]}>
              {t(`predictions.${item.key}`)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function ScenarioCard({
  scenarioKey,
  data,
  isMain,
  colors,
  t,
}: {
  scenarioKey: ScenarioKey;
  data: ScenarioData;
  isMain: boolean;
  colors: ReturnType<typeof useColors>;
  t: (key: string) => string;
}) {
  const SCENARIO_COLOR: Record<ScenarioKey, string> = {
    conservative: CONSERVATIVE_COLOR,
    realistic: palette.primary,
    optimistic: OPTIMISTIC_COLOR,
  };
  const color = SCENARIO_COLOR[scenarioKey];

  const rows = [
    { label: "30d", sgi: data.sgi30d, rank: data.rank30d },
    { label: "90d", sgi: data.sgi90d, rank: data.rank90d },
    { label: "180d", sgi: data.sgi180d, rank: data.rank180d },
  ];

  return (
    <View
      style={[
        st.scenarioCard,
        {
          borderColor: isMain ? color + "55" : colors.border,
          backgroundColor: isMain ? color + "0A" : colors.card,
        },
      ]}
    >
      <View style={st.scenarioHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[st.scenarioLabel, { color }]}>
            {t(`predictions.${scenarioKey}`)}
          </Text>
          <Text style={[st.scenarioDesc, { color: colors.mutedForeground }]}>
            {t(`predictions.${scenarioKey}Desc`)}
          </Text>
        </View>
        {isMain && (
          <View
            style={[
              st.mainBadge,
              { backgroundColor: color + "1A", borderColor: color + "44" },
            ]}
          >
            <Text style={[st.mainBadgeText, { color }]}>
              {t("predictions.main")}
            </Text>
          </View>
        )}
      </View>

      {rows.map((row, idx) => (
        <View
          key={row.label}
          style={[
            st.dataRow,
            {
              borderTopColor: colors.border + "60",
              borderTopWidth: idx === 0 ? 1 : 0.5,
            },
          ]}
        >
          <Text style={[st.dataRowLabel, { color: colors.mutedForeground }]}>
            {row.label}
          </Text>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={[st.dataRowSgi, { color }]}>
              {row.sgi.toFixed(1)}
            </Text>
            <Text style={[st.dataRowRank, { color: colors.mutedForeground }]}>
              #{row.rank.toLocaleString()}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function PremiumGate({
  colors,
  t,
  onUpgrade,
}: {
  colors: ReturnType<typeof useColors>;
  t: (key: string) => string;
  onUpgrade: () => void;
}) {
  return (
    <View style={st.gateContainer}>
      <View
        style={[
          st.gateLockCircle,
          {
            backgroundColor: palette.primary + "18",
            borderColor: palette.primary + "33",
          },
        ]}
      >
        <Ionicons name="lock-closed" size={30} color={palette.primary} />
      </View>
      <Text style={[st.gateTitle, { color: colors.foreground }]}>
        {t("predictions.lockedTitle")}
      </Text>
      <Text style={[st.gateDesc, { color: colors.mutedForeground }]}>
        {t("predictions.lockedDesc")}
      </Text>
      <Pressable
        style={({ pressed }) => [
          st.gateBtn,
          { backgroundColor: palette.primary, opacity: pressed ? 0.85 : 1 },
        ]}
        onPress={onUpgrade}
      >
        <Ionicons name="trending-up" size={18} color="#fff" />
        <Text style={st.gateBtnText}>{t("predictions.upgradePremium")}</Text>
      </Pressable>
      <Text style={[st.gateUnlock, { color: colors.mutedForeground }]}>
        {t("predictions.unlockDesc")}
      </Text>
    </View>
  );
}

function SkeletonPredictions() {
  return (
    <View style={{ gap: 16 }}>
      <SkeletonBox style={{ height: 110, borderRadius: 14 }} />
      <SkeletonBox style={{ height: 110, borderRadius: 14 }} />
      <SkeletonBox style={{ height: 110, borderRadius: 14 }} />
      <SkeletonBox style={{ height: 210, borderRadius: 14 }} />
    </View>
  );
}

export default function PredictionsScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { width: screenWidth } = useWindowDimensions();
  const chartWidth = screenWidth - 64;

  const { data: profile, isLoading: profileLoading } = useGetMyProfile();
  const { triggerPurchase } = usePurchase();
  const isPremiumOrPro =
    profile?.plan === "premium" || profile?.plan === "pro";

  const { data: predictions, isLoading: predLoading } = useGetPredictions({
    query: { enabled: isPremiumOrPro },
  });

  const isLoading = profileLoading || (isPremiumOrPro && predLoading);

  return (
    <AnimatedScreen>
      <View style={[st.container, { backgroundColor: colors.background }]}>
        <View
          style={[
            st.header,
            { paddingTop: insets.top + 8, borderBottomColor: colors.border },
          ]}
        >
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [st.backBtn, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Ionicons name="chevron-back" size={22} color={colors.foreground} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[st.headerTitle, { color: colors.foreground }]}>
              {t("predictions.title")}
            </Text>
            <Text style={[st.headerSubtitle, { color: colors.mutedForeground }]}>
              {t("predictions.subtitle")}
            </Text>
          </View>
        </View>

        {isLoading ? (
          <ScrollView
            contentContainerStyle={[
              st.scrollContent,
              { paddingBottom: tabBarHeight + 24 },
            ]}
          >
            <SkeletonPredictions />
          </ScrollView>
        ) : !isPremiumOrPro ? (
          <PremiumGate colors={colors} t={t} onUpgrade={() => triggerPurchase("premium")} />
        ) : !predictions ? null : (
          <ScrollView
            contentContainerStyle={[
              st.scrollContent,
              { paddingBottom: tabBarHeight + 24 },
            ]}
            showsVerticalScrollIndicator={false}
          >
            {(["conservative", "realistic", "optimistic"] as ScenarioKey[]).map(
              (key, idx) => (
                <Animated.View
                  key={key}
                  entering={FadeInDown.delay(idx * 80).duration(400)}
                >
                  <ScenarioCard
                    scenarioKey={key}
                    data={predictions[key]}
                    isMain={key === "realistic"}
                    colors={colors}
                    t={t}
                  />
                </Animated.View>
              )
            )}

            <Animated.View
              entering={FadeInDown.delay(280).duration(400)}
              style={[
                st.chartCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Text style={[st.chartTitle, { color: colors.foreground }]}>
                {t("predictions.trajectoryChart")}
              </Text>
              <PredictionChart
                currentScore={profile?.sgiScore ?? 0}
                predictions={predictions}
                colors={colors}
                chartWidth={chartWidth}
                t={t}
              />
            </Animated.View>

            <Text style={[st.disclaimer, { color: colors.mutedForeground }]}>
              {t("predictions.disclaimer")}
            </Text>
          </ScrollView>
        )}
      </View>
    </AnimatedScreen>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  backBtn: { paddingTop: 2, paddingRight: 4 },
  headerTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
    lineHeight: 17,
  },

  scrollContent: {
    padding: 16,
    gap: 12,
  },

  scenarioCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 4,
  },
  scenarioHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
    gap: 8,
  },
  scenarioLabel: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  scenarioDesc: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 3,
    lineHeight: 17,
  },
  mainBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
  },
  mainBadgeText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
  },
  dataRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 7,
  },
  dataRowLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  dataRowSgi: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  dataRowRank: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },

  chartCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginTop: 4,
  },
  chartTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 14,
  },

  xLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
    paddingHorizontal: 4,
  },
  xLabel: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
  },
  legend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 18,
    marginTop: 14,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },

  disclaimer: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 16,
    marginTop: 8,
    paddingHorizontal: 8,
  },

  gateContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 36,
    gap: 14,
  },
  gateLockCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  gateTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    letterSpacing: -0.3,
  },
  gateDesc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  gateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 26,
    paddingVertical: 13,
    marginTop: 4,
  },
  gateBtnText: {
    color: "#fff",
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  gateUnlock: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
});
