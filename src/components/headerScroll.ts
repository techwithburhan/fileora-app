/**
 * One top bar for all bottom tabs (app 1.1.1). It sits above the tab navigator, so it never moves
 * during a tab switch. Before, every tab drew its own bar, and the tab "shift" animation showed two
 * logos and the bar's shadow edge for a moment.
 *
 * The focused tab tells the bar how far its content is scrolled, so the bar's line and shadow still
 * appear only once content moves under it (Home, Tools); other tabs keep the line.
 */
import { useCallback } from 'react';
import { makeMutable, SharedValue } from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';

export const headerScroll = makeMutable(100);

export function useHeaderScroll(own?: SharedValue<number>) {
  useFocusEffect(
    useCallback(() => {
      headerScroll.value = own ? own.value : 100;
    }, [own]),
  );
}
