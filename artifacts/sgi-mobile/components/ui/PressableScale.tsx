import React, { useCallback } from "react";
import { Pressable } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

interface PressableScaleProps {
  onPress: () => void;
  style?: object | object[];
  children: React.ReactNode;
  disabled?: boolean;
  haptic?: boolean;
  scaleTarget?: number;
  hitSlop?: { top: number; bottom: number; left: number; right: number };
}

export function PressableScale({
  onPress,
  style,
  children,
  disabled = false,
  haptic = true,
  scaleTarget = 0.91,
  hitSlop,
}: PressableScaleProps) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(scaleTarget, { damping: 18, stiffness: 350 });
    opacity.value = withTiming(0.82, { duration: 70 });
  }, [scale, opacity, scaleTarget]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 14, stiffness: 220, mass: 0.8 });
    opacity.value = withTiming(1, { duration: 90 });
  }, [scale, opacity]);

  const handlePress = useCallback(() => {
    if (haptic && !disabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  }, [haptic, disabled, onPress]);

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={!disabled ? handlePressIn : undefined}
      onPressOut={!disabled ? handlePressOut : undefined}
      disabled={disabled}
      hitSlop={hitSlop}
    >
      <Animated.View style={[style, animatedStyle]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
