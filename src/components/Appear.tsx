/**
 * Fade (and slight rise) on first show, for content that sits in a list or a screen's flow.
 *
 * Why not Reanimated's `entering` layout animations here: on Android with the New Architecture,
 * a view whose entering animation is still running ignores layout updates. When rows are added
 * above it meanwhile (for example Settings once the notification permission is known, Home when
 * a banner or the ad card arrives, Tools while searching), it stays at its old position and other
 * rows are drawn over it: the "mismatched UI" seen on some starts. This component animates only
 * opacity and a transform, so the layout always follows the content.
 *
 * Overlays (sheets, dialogs, pop-ups) keep `entering`: nothing moves around them.
 */
import React, { useEffect } from 'react';
import { StyleProp, TextProps, TextStyle, ViewStyle } from 'react-native';
import Text from '../i18n/Text';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

type Common = { delay?: number; duration?: number; /** rise from below (FadeInDown); false = fade only */ rise?: boolean };
type ViewAppear = Common & Omit<React.ComponentProps<typeof Animated.View>, 'style'> & { text?: false; style?: StyleProp<ViewStyle> };
type TextAppear = Common & TextProps & { text: true; style?: StyleProp<TextStyle> };

const AnimatedText = Animated.createAnimatedComponent(Text);

export default function Appear(props: ViewAppear | TextAppear) {
  const { delay = 0, duration = 350, rise = true, style, children, text, ...rest } = props as ViewAppear & { text?: boolean };
  const reduced = useReducedMotion();
  const p = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (!reduced) p.value = withDelay(delay, withTiming(1, { duration, easing: Easing.out(Easing.cubic) }));
    // first show only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const anim = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: rise ? [{ translateY: (1 - p.value) * 12 }] : [],
  }));
  if (text) {
    return (
      <AnimatedText {...(rest as TextProps)} style={[style as StyleProp<TextStyle>, anim]}>
        {children}
      </AnimatedText>
    );
  }
  return (
    <Animated.View {...(rest as Omit<React.ComponentProps<typeof Animated.View>, 'style'>)} style={[style as StyleProp<ViewStyle>, anim]}>
      {children}
    </Animated.View>
  );
}
