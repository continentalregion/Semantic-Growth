import React, { useEffect } from "react";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  withSpring,
  Easing,
} from "react-native-reanimated";

interface StaggeredItemProps {
  index: number;
  children: React.ReactNode;
  style?: object;
  baseDelay?: number;
  stepDelay?: number;
}

export function StaggeredItem({
  index,
  children,
  style,
  baseDelay = 0,
  stepDelay = 45,
}: StaggeredItemProps) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(14);

  useEffect(() => {
    const delay = baseDelay + index * stepDelay;
    opacity.value = withDelay(delay, withTiming(1, { duration: 280, easing: Easing.out(Easing.ease) }));
    translateY.value = withDelay(delay, withSpring(0, { damping: 20, stiffness: 260, mass: 0.7 }));
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[animStyle, style]}>
      {children}
    </Animated.View>
  );
}
