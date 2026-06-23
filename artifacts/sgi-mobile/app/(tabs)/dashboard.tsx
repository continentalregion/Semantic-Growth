import React, { useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Platform,
  TextInput,
  useWindowDimensions,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withTiming,
  withSpring,
  Easing,
  createAnimatedComponent,
} from "react-native-reanimated";
import Svg, {
  Path,
  Circle,
  Defs,
  LinearGradient as SvgGradient,
  Stop,
  ClipPath,
  Rect as SvgRect,
} from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import {
  useGetMyProfile,
  useGetSgiHistory,
  useGetPredictions,
  useGetSemanticMap,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { palette } from "@/constants/theme";
import { AnimatedScreen } from "@/components/ui/AnimatedScreen";
import { SkeletonCard, SkeletonBox } from "@/components/ui/SkeletonBox";

const AnimatedTextInput = createAnimatedComponent(TextInput);
const AnimatedRect = createAnimatedComponent(SvgRect);

const MACRO_DIMS = [
  {
    key: "profondita" as const,
    label: "Profondità",
    desc: "Quanto vai a fondo: complessità dei concetti e lunghezza del ragionamento.",
    color: palette.primary,
  },
  {
    key: "connettivita" as const,
    label: "Connettività",
    desc: "Quanto colleghi ambiti diversi e vari i campi semantici.",
    color: palette.cyan,
  },
  {
    key: "precisione" as const,
    label: "Precisione",
    desc: "Densità di informazione e ricchezza del lessico.",
    color: palette.violet,
  },
  {
    key: "revisione" as const,
    label: "Revisione",
    desc: "Quanto rivedi e raffini ciò che scrivi.",
    color: palette.teal,
  },
] as const;

const RAW_METRICS = [
  {
    key: "conceptualComplexity" as const,
    label: "Complessità concettuale",
    desc: "Quanti concetti distinti e non banali introduci.",
    color: palette.primary,
  },
  {
    key: "semanticVariety" as const,
    label: "Varietà semantica",
    desc: "Ampiezza dei campi di significato che tocchi.",
    color: palette.cyan,
  },
  {
    key: "interdisciplinaryScore" as const,
    label: "Interdisciplinarità",
    desc: "Ponti tra domini diversi (es. fisica e filosofia).",
    color: palette.violet,
  },
  {
    key: "reasoningDepth" as const,
    label: "Profondità di ragionamento",
    desc: "Quanto è lunga e articolata la catena logica.",
    color: palette.teal,
  },
  {
    key: "originality" as const,
    label: "Originalità",
    desc: "Quanto ti allontani dal modo ovvio di inquadrare le cose.",
    color: palette.gold,
  },
  {
    key: "stability" as const,
    label: "Stabilità",
    desc: "Coerenza interna, assenza di contraddizioni.",
    color: palette.success,
  },
  {
    key: "continuity" as const,
    label: "Continuità",
    desc: "Quanto costruisci sul contesto precedente.",
    color: palette.secondary,
  },
] as const;

function AnimatedCounter({
  value,
  decimals = 1,
  style,
}: {
  value: number;
  decimals?: number;
  style?: object;
}) {
  const sv = useSharedValue(0);
  useEffect(() => {
    sv.value = withTiming(value, { duration: 1400, easing: Easing.out(Easing.cubic) });
  }, [value]);
  const animProps = useAnimatedProps(() => ({
    text: sv.value.toFixed(decimals),
    defaultValue: sv.value.toFixed(decimals),
  }));
  return (
    <AnimatedTextInput
      animatedProps={animProps}
      editable={false}
      style={style}
      underlineColorAndroid="transparent"
    />
  );
}

function DeltaChip({ label, value, colors }: {
  label: string;
  value: number | null | undefined;
  colors: ReturnType<typeof useColors>;
}) {
  const v = value ?? 0;
  const isUp = v >= 0;
  const c = v === 0 ? colors.mutedForeground : isUp ? colors.teal : colors.destructive;
  return (
    <View style={[chipSt.root, { backgroundColor: c + "15", borderColor: c + "30" }]}>
      {v !== 0 && (
        <Ionicons name={isUp ? "trending-up" : "trending-down"} size={10} color={c} />
      )}
      <Text style={[chipSt.val, { color: c }]}>
        {v > 0 ? "+" : ""}{v.toFixed(2)}
      </Text>
      <Text style={[chipSt.lbl, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

const chipSt = StyleSheet.create({
  root: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  val: { fontSize: 11, fontFamily: "Inter_700Bold" },
  lbl: { fontSize: 10, fontFamily: "Inter_400Regular" },
});

function AnimatedBar({
  value,
  max = 10,
  color,
  bg,
  height = 7,
}: {
  value: number;
  max?: number;
  color: string;
  bg: string;
  height?: number;
}) {
  const pct = useSharedValue(0);
  useEffect(() => {
    const target = Math.min(Math.max((value / max) * 100, 0), 100);
    pct.value = withSpring(target, { damping: 16, stiffness: 90, mass: 1 });
  }, [value, max]);
  const animStyle = useAnimatedStyle(() => ({ width: `${pct.value}%` as any }));
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: bg, overflow: "hidden" }}>
      <Animated.View style={[{ height: "100%", backgroundColor: color, borderRadius: height / 2 }, animStyle]} />
    </View>
  );
}

function ScoreLineChart({
  data,
  colors,
  width,
}: {
  data: { score: number; timestamp: string }[];
  colors: ReturnType<typeof useColors>;
  width: number;
}) {
  const H = 100;
  const PAD_X = 0;
  const PAD_Y = 8;
  const W = width;

  const scores = data.map(d => d.score);
  const minS = Math.min(...scores);
  const maxS = Math.max(...scores);
  const range = maxS - minS || 1;

  const pts = data.map((d, i) => {
    const x = PAD_X + (i / Math.max(data.length - 1, 1)) * (W - PAD_X * 2);
    const y = PAD_Y + (1 - (d.score - minS) / range) * (H - PAD_Y * 2);
    return { x, y };
  });

  let linePath = "";
  let areaPath = "";
  if (pts.length >= 2) {
    const smooth = (p1: typeof pts[0], p2: typeof pts[0]) => {
      const cpX = (p1.x + p2.x) / 2;
      return `C ${cpX} ${p1.y} ${cpX} ${p2.y} ${p2.x} ${p2.y}`;
    };
    linePath = `M ${pts[0].x} ${pts[0].y}` + pts.slice(1).map((p, i) => smooth(pts[i], p)).join(" ");
    areaPath = linePath + ` L ${pts[pts.length - 1].x} ${H} L ${pts[0].x} ${H} Z`;
  }

  const revealPct = useSharedValue(0);
  useEffect(() => {
    revealPct.value = withTiming(100, { duration: 1200, easing: Easing.out(Easing.cubic) });
  }, []);

  const animRectProps = useAnimatedProps(() => ({
    width: (revealPct.value / 100) * W,
  }));

  const lastPt = pts[pts.length - 1];

  const labels: string[] = [];
  if (data.length >= 1) {
    const first = new Date(data[0].timestamp);
    const last = new Date(data[data.length - 1].timestamp);
    labels.push(`${first.getDate()}/${first.getMonth() + 1}`);
    labels.push(`${last.getDate()}/${last.getMonth() + 1}`);
  }

  return (
    <View>
      <Svg width={W} height={H}>
        <Defs>
          <SvgGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={palette.primary} stopOpacity={0.22} />
            <Stop offset="100%" stopColor={palette.primary} stopOpacity={0.0} />
          </SvgGradient>
          <ClipPath id="revealClip">
            <AnimatedRect x={0} y={0} height={H} animatedProps={animRectProps} />
          </ClipPath>
        </Defs>
        {pts.length >= 2 && (
          <>
            <Path d={areaPath} fill="url(#chartFill)" clipPath="url(#revealClip)" />
            <Path
              d={linePath}
              stroke={palette.primary}
              strokeWidth={2.2}
              fill="none"
              clipPath="url(#revealClip)"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        )}
        {lastPt && (
          <>
            <Circle cx={lastPt.x} cy={lastPt.y} r={5} fill={palette.primary} opacity={0.3} />
            <Circle cx={lastPt.x} cy={lastPt.y} r={3} fill={palette.primary} />
          </>
        )}
      </Svg>
      {labels.length === 2 && (
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
          <Text style={{ color: colors.mutedForeground, fontSize: 10, fontFamily: "Inter_400Regular" }}>{labels[0]}</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 10, fontFamily: "Inter_400Regular" }}>{labels[1]}</Text>
        </View>
      )}
    </View>
  );
}

function PremiumGateCard({
  title,
  desc,
  icon,
  colors,
}: {
  title: string;
  desc: string;
  icon: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={[gSt.root, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[gSt.iconWrap, { backgroundColor: colors.muted }]}>
        <Text style={{ fontSize: 22 }}>{icon}</Text>
      </View>
      <Text style={[gSt.title, { color: colors.foreground }]}>{title}</Text>
      <Text style={[gSt.desc, { color: colors.mutedForeground }]}>{desc}</Text>
      <View style={[gSt.badge, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "33" }]}>
        <Ionicons name="lock-closed" size={12} color={colors.primary} />
        <Text style={{ color: colors.primary, fontSize: 12, fontFamily: "Inter_600SemiBold", marginLeft: 4 }}>
          Premium o Pro
        </Text>
      </View>
    </View>
  );
}

const gSt = StyleSheet.create({
  root: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 20,
    alignItems: "center",
    gap: 8,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  title: { fontSize: 15, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  desc: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 19 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 4,
  },
});

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { width: screenWidth } = useWindowDimensions();
  const chartWidth = screenWidth - 32 - 32;

  const {
    data: profile,
    isLoading: profileLoading,
    refetch: refetchProfile,
    isRefetching: refetchingProfile,
  } = useGetMyProfile();

  const {
    data: history,
    isLoading: historyLoading,
    refetch: refetchHistory,
  } = useGetSgiHistory({ days: 30 });

  const isPremiumOrPro = profile?.plan === "premium" || profile?.plan === "pro";

  const { data: predictions } = useGetPredictions({
    query: { enabled: isPremiumOrPro },
  });

  const { data: semanticMap } = useGetSemanticMap({
    query: { enabled: isPremiumOrPro },
  });

  const isLoading = profileLoading || historyLoading;
  const isRefreshing = refetchingProfile;

  const macro = (profile as unknown as {
    macroDimensions?: {
      profondita?: number;
      connettivita?: number;
      precisione?: number;
      revisione?: number;
    };
  })?.macroDimensions;

  const histArr = useMemo(() => {
    if (!Array.isArray(history)) return [];
    return [...history].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }, [history]);

  const lastSnapshot = histArr[histArr.length - 1];

  const planLabel: Record<string, string> = {
    free: "Free",
    premium: "Premium ⚡",
    pro: "Pro 🚀",
  };
  const planColor: Record<string, string> = {
    free: colors.mutedForeground,
    premium: colors.gold,
    pro: colors.teal,
  };
  const pl = profile?.plan ?? "free";

  const topDomains = useMemo(() => {
    if (!semanticMap?.nodes) return [];
    return [...semanticMap.nodes]
      .sort((a, b) => b.explorationScore - a.explorationScore)
      .slice(0, 6);
  }, [semanticMap]);

  return (
    <AnimatedScreen style={{ backgroundColor: colors.background }}>
      <View
        style={[
          st.header,
          {
            paddingTop: Platform.OS === "web" ? 67 : insets.top,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Ionicons name="analytics" size={20} color={colors.primary} />
        <Text style={[st.headerTitle, { color: colors.foreground }]}>Dashboard</Text>
        <View
          style={[
            st.planChip,
            {
              borderColor: (planColor[pl] ?? colors.mutedForeground) + "44",
              backgroundColor: (planColor[pl] ?? colors.mutedForeground) + "18",
            },
          ]}
        >
          <Text
            style={{
              color: planColor[pl] ?? colors.mutedForeground,
              fontSize: colors.font.size.xs,
              fontFamily: colors.font.family.semibold,
            }}
          >
            {planLabel[pl] ?? "Free"}
          </Text>
        </View>
      </View>

      {isLoading ? (
        <View
          style={{
            flex: 1,
            paddingHorizontal: 16,
            paddingTop: 16,
            gap: 16,
          }}
        >
          <SkeletonCard
            style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}
          />
          <SkeletonCard
            style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}
          />
          <View style={{ gap: 12 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <View key={i} style={{ gap: 6 }}>
                <SkeletonBox width="55%" height={12} borderRadius={6} />
                <SkeletonBox width="100%" height={8} borderRadius={4} />
              </View>
            ))}
          </View>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: tabBarHeight + 24,
            gap: 14,
          }}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => {
                refetchProfile();
                refetchHistory();
              }}
              tintColor={colors.primary}
            />
          }
        >
          {/* ── BLOCCO A ─ Hero Score ── */}
          <View
            style={[
              st.card,
              {
                backgroundColor: colors.card,
                borderColor: colors.primary + "33",
                gap: 12,
              },
            ]}
          >
            <Text style={[st.sectionMicro, { color: colors.mutedForeground }]}>
              SGI SCORE
            </Text>

            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 12 }}>
              <AnimatedCounter
                value={profile?.sgiScore ?? 0}
                decimals={1}
                style={[st.bigScore, { color: colors.primary }]}
              />
              <View
                style={{
                  flex: 1,
                  paddingBottom: 8,
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 6,
                }}
              >
                <DeltaChip label="oggi" value={profile?.sgiDailyDelta} colors={colors} />
                <DeltaChip label="settimana" value={profile?.sgiWeeklyDelta} colors={colors} />
                <DeltaChip label="mese" value={profile?.sgiMonthlyDelta} colors={colors} />
              </View>
            </View>

            {/* Rank + percentile row */}
            {(profile?.globalRank != null || profile?.percentile != null) && (
              <View
                style={{
                  flexDirection: "row",
                  gap: 10,
                  paddingTop: 10,
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                }}
              >
                {profile?.globalRank != null && (
                  <View style={st.miniStatCell}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Ionicons name="trophy" size={13} color={colors.gold} />
                      <Text style={[st.miniStatNum, { color: colors.foreground }]}>
                        #{profile.globalRank}
                      </Text>
                    </View>
                    <Text style={[st.miniStatLbl, { color: colors.mutedForeground }]}>
                      Posizione globale
                    </Text>
                  </View>
                )}
                {profile?.percentile != null && (
                  <View style={[st.miniStatCell, { borderLeftWidth: 1, borderLeftColor: colors.border, paddingLeft: 10 }]}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Ionicons name="podium" size={13} color={colors.teal} />
                      <Text style={[st.miniStatNum, { color: colors.foreground }]}>
                        Top {(100 - profile.percentile).toFixed(0)}%
                      </Text>
                    </View>
                    <Text style={[st.miniStatLbl, { color: colors.mutedForeground }]}>
                      Tra tutti gli utenti
                    </Text>
                  </View>
                )}
                {profile?.totalUsers != null && (
                  <View style={[st.miniStatCell, { borderLeftWidth: 1, borderLeftColor: colors.border, paddingLeft: 10 }]}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Ionicons name="people" size={13} color={colors.primary} />
                      <Text style={[st.miniStatNum, { color: colors.foreground }]}>
                        {profile.totalUsers}
                      </Text>
                    </View>
                    <Text style={[st.miniStatLbl, { color: colors.mutedForeground }]}>
                      Utenti totali
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* ── BLOCCO B ─ Line Chart ── */}
          {histArr.length >= 2 && (
            <View
              style={[
                st.card,
                { backgroundColor: colors.card, borderColor: colors.border, gap: 10 },
              ]}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={[st.sectionTitle, { color: colors.foreground }]}>
                  Trend (30 giorni)
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Text style={{ color: colors.mutedForeground, fontSize: 11, fontFamily: "Inter_400Regular" }}>
                    {histArr[histArr.length - 1]?.score.toFixed(1)}
                  </Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>pts</Text>
                </View>
              </View>
              <ScoreLineChart
                data={histArr}
                colors={colors}
                width={chartWidth}
              />
            </View>
          )}

          {/* ── BLOCCO C ─ 4 Macro dimensioni ── */}
          {macro && (
            <View
              style={[
                st.card,
                { backgroundColor: colors.card, borderColor: colors.border, gap: 16 },
              ]}
            >
              <Text style={[st.sectionTitle, { color: colors.foreground }]}>
                Dimensioni semantiche
              </Text>
              {MACRO_DIMS.map(dim => {
                const val = macro[dim.key] ?? 0;
                return (
                  <View key={dim.key} style={{ gap: 6 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
                      <Text
                        style={{
                          color: colors.foreground,
                          fontFamily: "Inter_600SemiBold",
                          fontSize: 13,
                        }}
                      >
                        {dim.label}
                      </Text>
                      <Text
                        style={{
                          color: dim.color,
                          fontFamily: "Inter_700Bold",
                          fontSize: 13,
                        }}
                      >
                        {val.toFixed(1)}/10
                      </Text>
                    </View>
                    <Text
                      style={{
                        color: colors.mutedForeground,
                        fontSize: 11,
                        fontFamily: "Inter_400Regular",
                        lineHeight: 16,
                      }}
                    >
                      {dim.desc}
                    </Text>
                    <AnimatedBar value={val} max={10} color={dim.color} bg={colors.muted} height={7} />
                  </View>
                );
              })}
            </View>
          )}

          {/* ── BLOCCO D ─ 7 Metriche raw ── */}
          {lastSnapshot && (
            <View
              style={[
                st.card,
                { backgroundColor: colors.card, borderColor: colors.border, gap: 14 },
              ]}
            >
              <View>
                <Text style={[st.sectionTitle, { color: colors.foreground }]}>
                  Metriche dettagliate
                </Text>
                <Text
                  style={{
                    color: colors.mutedForeground,
                    fontSize: 11,
                    fontFamily: "Inter_400Regular",
                    marginTop: 2,
                  }}
                >
                  Dall'ultima sessione
                </Text>
              </View>
              {RAW_METRICS.map(m => {
                const val = (lastSnapshot as unknown as Record<string, number>)[m.key] ?? 0;
                return (
                  <View key={m.key} style={{ gap: 5 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
                      <Text
                        style={{
                          color: colors.foreground,
                          fontFamily: "Inter_500Medium",
                          fontSize: 12,
                          flex: 1,
                          marginRight: 8,
                        }}
                      >
                        {m.label}
                      </Text>
                      <Text
                        style={{
                          color: m.color,
                          fontFamily: "Inter_700Bold",
                          fontSize: 12,
                        }}
                      >
                        {val.toFixed(1)}
                      </Text>
                    </View>
                    <Text
                      style={{
                        color: colors.mutedForeground,
                        fontSize: 10,
                        fontFamily: "Inter_400Regular",
                        lineHeight: 14,
                      }}
                    >
                      {m.desc}
                    </Text>
                    <AnimatedBar value={val} max={10} color={m.color} bg={colors.muted} height={5} />
                  </View>
                );
              })}
            </View>
          )}

          {/* ── BLOCCO E ─ Premium/Pro features ── */}
          {isPremiumOrPro ? (
            <>
              {/* Predizioni */}
              {predictions && (
                <View
                  style={[
                    st.card,
                    { backgroundColor: colors.card, borderColor: colors.border, gap: 14 },
                  ]}
                >
                  <View>
                    <Text style={[st.sectionTitle, { color: colors.foreground }]}>
                      Proiezioni future
                    </Text>
                    <Text
                      style={{
                        color: colors.mutedForeground,
                        fontSize: 11,
                        fontFamily: "Inter_400Regular",
                        marginTop: 2,
                      }}
                    >
                      Scenario realistico al tuo ritmo attuale
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {[
                      { label: "30 giorni", sgi: predictions.realistic.sgi30d, rank: predictions.realistic.rank30d },
                      { label: "90 giorni", sgi: predictions.realistic.sgi90d, rank: predictions.realistic.rank90d },
                      { label: "180 giorni", sgi: predictions.realistic.sgi180d, rank: predictions.realistic.rank180d },
                    ].map(p => (
                      <View
                        key={p.label}
                        style={[
                          st.predCell,
                          { backgroundColor: colors.muted, flex: 1 },
                        ]}
                      >
                        <Text
                          style={{
                            color: colors.mutedForeground,
                            fontSize: 10,
                            fontFamily: "Inter_400Regular",
                            marginBottom: 4,
                          }}
                        >
                          {p.label}
                        </Text>
                        <Text
                          style={{
                            color: colors.primary,
                            fontFamily: "Inter_700Bold",
                            fontSize: 18,
                          }}
                        >
                          {p.sgi.toFixed(1)}
                        </Text>
                        <Text
                          style={{
                            color: colors.mutedForeground,
                            fontSize: 10,
                            fontFamily: "Inter_400Regular",
                            marginTop: 2,
                          }}
                        >
                          #{p.rank} globale
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Mappa semantica */}
              {topDomains.length > 0 && (
                <View
                  style={[
                    st.card,
                    { backgroundColor: colors.card, borderColor: colors.border, gap: 12 },
                  ]}
                >
                  <Text style={[st.sectionTitle, { color: colors.foreground }]}>
                    Mappa semantica
                  </Text>
                  <Text
                    style={{
                      color: colors.mutedForeground,
                      fontSize: 11,
                      fontFamily: "Inter_400Regular",
                      marginTop: -4,
                    }}
                  >
                    I domini che esplori di più
                  </Text>
                  <View style={{ gap: 8 }}>
                    {topDomains.map((node, idx) => (
                      <View
                        key={node.id}
                        style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
                      >
                        <View
                          style={[
                            st.domainRank,
                            {
                              backgroundColor:
                                idx === 0 ? colors.gold + "22" : colors.muted,
                            },
                          ]}
                        >
                          <Text
                            style={{
                              color: idx === 0 ? colors.gold : colors.mutedForeground,
                              fontFamily: "Inter_700Bold",
                              fontSize: 11,
                            }}
                          >
                            {idx + 1}
                          </Text>
                        </View>
                        <View style={{ flex: 1, gap: 3 }}>
                          <Text
                            style={{
                              color: colors.foreground,
                              fontFamily: "Inter_500Medium",
                              fontSize: 12,
                              textTransform: "capitalize",
                            }}
                          >
                            {node.domain.replace(/_/g, " ")}
                          </Text>
                          <AnimatedBar
                            value={node.explorationScore}
                            max={10}
                            color={
                              [palette.primary, palette.cyan, palette.violet, palette.teal, palette.gold, palette.success][idx % 6]
                            }
                            bg={colors.muted}
                            height={4}
                          />
                        </View>
                        <Text
                          style={{
                            color: colors.mutedForeground,
                            fontSize: 10,
                            fontFamily: "Inter_400Regular",
                            minWidth: 28,
                            textAlign: "right",
                          }}
                        >
                          {node.messageCount} msg
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </>
          ) : (
            <>
              <PremiumGateCard
                title="Proiezioni future"
                desc="Vedi dove arriverai in 30, 90 e 180 giorni se mantieni il ritmo attuale."
                icon="🔮"
                colors={colors}
              />
              <PremiumGateCard
                title="Mappa semantica"
                desc="Esplora i domini del sapere che stai sviluppando e scopri dove sei più forte."
                icon="🗺️"
                colors={colors}
              />
            </>
          )}
        </ScrollView>
      )}
    </AnimatedScreen>
  );
}

const st = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  planChip: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
  sectionMicro: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 1.4,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  bigScore: {
    fontSize: 62,
    fontFamily: "Inter_700Bold",
    lineHeight: 68,
    minWidth: 120,
    includeFontPadding: false,
  },
  miniStatCell: {
    flex: 1,
    gap: 2,
  },
  miniStatNum: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  miniStatLbl: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
  },
  predCell: {
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
  },
  domainRank: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
});
