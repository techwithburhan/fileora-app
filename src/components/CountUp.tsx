/**
 * App 1.2.4: a number that counts up to its value when it first shows (and glides to a new value
 * when it changes), e.g. the file counts in Files → My Storage. Plain text with "Reduce motion".
 */
import React, { useEffect, useRef, useState } from 'react';
import { StyleProp, TextStyle } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import Text from '../i18n/Text';

export default function CountUp({ value, style, ms = 650 }: { value: number; style?: StyleProp<TextStyle>; ms?: number }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced ? value : 0);
  const now = useRef(reduced ? value : 0);
  useEffect(() => {
    if (reduced || now.current === value) {
      now.current = value;
      setShown(value);
      return;
    }
    const from = now.current;
    const t0 = Date.now();
    let raf = 0;
    const step = () => {
      const p = Math.min(1, (Date.now() - t0) / ms);
      const v = Math.round(from + (value - from) * (1 - Math.pow(1 - p, 3)));
      now.current = v;
      setShown(v);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, reduced, ms]);
  return (
    <Text style={style} accessibilityLabel={String(value)}>
      {String(shown)}
    </Text>
  );
}
