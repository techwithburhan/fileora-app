/** One type scale for the whole app, so small text looks the same in every tool and list. */
import { StyleSheet } from 'react-native';

export const type = StyleSheet.create({
  display: { fontSize: 25, lineHeight: 31, fontWeight: '800' },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '800' },
  section: { fontSize: 18, lineHeight: 24, fontWeight: '800' },
  heading: { fontSize: 15.5, lineHeight: 21, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 22 },
  bodySm: { fontSize: 13.5, lineHeight: 19 },
  caption: { fontSize: 12.5, lineHeight: 17, fontWeight: '600' },
  overline: { fontSize: 11.5, lineHeight: 15, fontWeight: '800', letterSpacing: 1 },
  button: { fontSize: 15, lineHeight: 20, fontWeight: '800' },
});
