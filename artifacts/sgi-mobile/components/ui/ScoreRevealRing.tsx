import React, { useCallback, useEffect } from "react";
import { View, TextInput, StyleSheet, type TextStyle } from "react-native";
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
  runOnJS,
  createAnimatedComponent,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { palette } from "@/constants/theme";

const AnimatedCircle = createAnimatedComponent(Circle);
const AnimatedTextInput = createAnimatedComponent(TextInput);

type Props = {
  /** Current SGI value (e.g. 7.4) */
  value: number;
  /** Scale maximum the ring fills against (SGI is 0–100) */
  max?: number;
  /** Outer diameter of the ring in px */
  size?: number;
  /** Ring stroke thickness in px */
  strokeWidth?: number;
  /** Decimal places for the count-up number */
  decimals?: number;
  /** Reveal duration in ms (count-up + ring fill, kept in lockstep) */
  duration?: number;
  /** Colour of the centred count-up number */
  numberColor: string;
  /** Colour of the unfilled track */
  trackColor: string;
  /** Gradient start (defaults to brand purple) */
  gradientFrom?: string;
  /** Gradient end (defaults to brand teal) */
  gradientTo?: string;
  /** Extra style for the centred number */
  numberStyle?: TextStyle;
  /** Accessible label describing the value (ring itself is decorative) */
  accessibilityLabel?: string;
};

/**
 * Premium SGI score reveal: a single shared progress value [0→1] drives BOTH the
 * count-up number and the SVG ring fill so they stay perfectly in sync, easing
 * out over ~1.2s. A success haptic fires once the reveal completes.
 */
export function ScoreRevealRing({
  value,
  max = 100,
  size = 132,
  strokeWidth = 11,
  decimals = 1,
  duration = 1200,
  numberColor,
  trackColor,
  gradientFrom = palette.primary,
  gradientTo = palette.teal,
  numberStyle,
  accessibilityLabel,
}: Props) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const target = Math.min(Math.max(value / max, 0), 1);

  const progress = useSharedValue(0);

  const fireHaptic = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, []);

  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(
      1,
      { duration, easing: Easing.out(Easing.cubic) },
      (finished) => {
        "worklet";
        if (finished && target > 0) {
          runOnJS(fireHaptic)();
        }
      },
    );
  }, [value, duration, target, progress, fireHaptic]);

  const circleProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value * target),
  }));

  const textProps = useAnimatedProps(() => {
    const shown = (progress.value * value).toFixed(decimals);
    return { text: shown, defaultValue: shown } as never;
  });

  return (
    <View
      style={[styles.wrap, { width: size, height: size }]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel ?? value.toFixed(decimals)}
    >
      <Svg
        width={size}
        height={size}
        style={[styles.svg, { transform: [{ rotate: "-90deg" }] }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
      >
        <Defs>
          <SvgGradient id="sgiRingGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor={gradientFrom} />
            <Stop offset="100%" stopColor={gradientTo} />
          </SvgGradient>
        </Defs>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#sgiRingGrad)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          animatedProps={circleProps}
        />
      </Svg>
      <AnimatedTextInput
        editable={false}
        accessible={false}
        underlineColorAndroid="transparent"
        importantForAccessibility="no"
        animatedProps={textProps}
        style={[styles.number, { color: numberColor }, numberStyle]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  svg: {
    position: "absolute",
  },
  number: {
    fontFamily: "Inter_700Bold",
    fontSize: 38,
    textAlign: "center",
    padding: 0,
    minWidth: 96,
    includeFontPadding: false,
  },
});
