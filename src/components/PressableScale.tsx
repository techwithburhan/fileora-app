/** A Pressable that eases down a little while pressed (Reanimated, UI thread). No bounce. */
import React from 'react';
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

const APressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, 'style'> & { style?: StyleProp<ViewStyle>; scaleTo?: number };

export default function PressableScale({ style, scaleTo = 0.96, onPressIn, onPressOut, ...rest }: Props) {
  const s = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <APressable
      {...rest}
      onPressIn={e => {
        s.value = withTiming(scaleTo, { duration: 110, easing: Easing.out(Easing.quad) });
        onPressIn?.(e);
      }}
      onPressOut={e => {
        s.value = withTiming(1, { duration: 180, easing: Easing.out(Easing.cubic) });
        onPressOut?.(e);
      }}
      style={[style, anim]}
    />
  );
}
