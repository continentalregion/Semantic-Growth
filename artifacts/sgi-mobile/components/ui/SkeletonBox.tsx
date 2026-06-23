import React, { useEffect } from "react";
import { View, StyleSheet, DimensionValue } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useColors } from "@/hooks/useColors";

interface SkeletonBoxProps {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  style?: object;
}

export function SkeletonBox({
  width = "100%",
  height = 16,
  borderRadius = 8,
  style,
}: SkeletonBoxProps) {
  const colors = useColors();
  const shimmer = useSharedValue(-1);

  useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmer.value * 300 }],
  }));

  return (
    <View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: colors.muted,
          overflow: "hidden",
        },
        style,
      ]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]}>
        <LinearGradient
          colors={["transparent", "rgba(255,255,255,0.06)", "transparent"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

export function SkeletonRow({ style }: { style?: object }) {
  return (
    <View style={[{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 13 }, style]}>
      <SkeletonBox width={38} height={38} borderRadius={19} />
      <View style={{ flex: 1, gap: 6 }}>
        <SkeletonBox width="60%" height={14} borderRadius={7} />
        <SkeletonBox width="35%" height={11} borderRadius={5} />
      </View>
      <SkeletonBox width={40} height={18} borderRadius={6} />
    </View>
  );
}

export function SkeletonCard({ style }: { style?: object }) {
  return (
    <View style={[{ borderRadius: 14, padding: 16, gap: 12 }, style]}>
      <SkeletonBox width="45%" height={11} borderRadius={5} />
      <SkeletonBox width="30%" height={36} borderRadius={8} />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <SkeletonBox width={80} height={28} borderRadius={10} />
        <SkeletonBox width={80} height={28} borderRadius={10} />
        <SkeletonBox width={80} height={28} borderRadius={10} />
      </View>
    </View>
  );
}

export function SkeletonListCard({ style }: { style?: object }) {
  return (
    <View style={[{ borderRadius: 14, padding: 14, gap: 10, marginHorizontal: 16, marginBottom: 10 }, style]}>
      <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
        <SkeletonBox width={44} height={44} borderRadius={12} />
        <View style={{ flex: 1, gap: 6 }}>
          <SkeletonBox width="40%" height={11} borderRadius={5} />
          <SkeletonBox width="80%" height={14} borderRadius={6} />
          <SkeletonBox width="65%" height={14} borderRadius={6} />
        </View>
      </View>
    </View>
  );
}
