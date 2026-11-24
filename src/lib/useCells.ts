/**
 * Exact cell widths for wrapped grids (app 1.0).
 *
 * Grids used percentage widths with a fixed gap (two cells of 48.5% + 10 pt). On narrow screens, or
 * with a larger Display size / Font size in Android settings, 97% + 10 pt was wider than the row,
 * so every second card wrapped and the Home categories showed one half-width card per row. Now the
 * row is measured and each cell gets floor((width - gaps) / columns), which always fits.
 * Until the first measurement a safe percentage is used.
 */
import { useCallback, useState } from 'react';
import { DimensionValue, LayoutChangeEvent } from 'react-native';

export function useCells(columns: number, gap: number) {
  const [row, setRow] = useState(0);
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    setRow(old => (Math.abs(old - w) >= 1 ? w : old));
  }, []);
  const width: DimensionValue = row > 0 ? Math.floor((row - gap * (columns - 1)) / columns) : `${Math.floor(100 / columns) - 4}%`;
  return { onLayout, width };
}
