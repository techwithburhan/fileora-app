/**
 * If something in the app fails unexpectedly, show a "Something went wrong" screen with
 * "Try again" instead of a blank screen or the app closing. The error (message only, no file
 * names) is reported to App Monitoring, and pending saves are written first.
 *
 * Also catches fatal JavaScript errors outside rendering (installGlobalErrorHandler), which
 * would otherwise close the app.
 */
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Text from '../i18n/Text';
import Icon from './Icon';
import PressableScale from './PressableScale';
import { flushAll } from '../lib/safeFile';
import { telemetry } from '../remote/telemetry';
import { brand } from '../theme';

type State = { error: Error | null; resets: number };
const boundaries = new Set<ErrorBoundary>();

function report(kind: string, e: unknown) {
  const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  telemetry.track('error', undefined, 0, `${kind}: ${msg}`);
  flushAll();
}

export default class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null, resets: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidMount() {
    boundaries.add(this);
  }
  componentWillUnmount() {
    boundaries.delete(this);
  }
  componentDidCatch(error: Error) {
    report('screen', error);
  }

  show(error: Error) {
    this.setState({ error });
  }

  retry = () => this.setState(s => ({ error: null, resets: s.resets + 1 }));

  render() {
    if (!this.state.error) return <React.Fragment key={this.state.resets}>{this.props.children}</React.Fragment>;
    return (
      <View style={styles.root} accessibilityViewIsModal>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.icon}>
            <Icon name="info" size={34} color={brand.green} width={2.2} />
          </View>
          <Text style={styles.title} accessibilityRole="header">
            Something went wrong
          </Text>
          <Text style={styles.text}>Your files are safe on this phone. Tap “Try again” to carry on. If it keeps happening, please update the app or contact us.</Text>
          <PressableScale onPress={this.retry} accessibilityRole="button" style={styles.btn}>
            <Icon name="refresh" size={18} color="#03213F" width={2.3} />
            <Text style={styles.btnText}>Try again</Text>
          </PressableScale>
        </ScrollView>
      </View>
    );
  }
}

/** Fatal JS errors: report, save, and show the recovery screen instead of closing the app. */
export function installGlobalErrorHandler() {
  const g = globalThis as unknown as {
    ErrorUtils?: { getGlobalHandler: () => (e: unknown, fatal?: boolean) => void; setGlobalHandler: (h: (e: unknown, fatal?: boolean) => void) => void };
  };
  const eu = g.ErrorUtils;
  if (!eu) return;
  const previous = eu.getGlobalHandler();
  eu.setGlobalHandler((e, fatal) => {
    report(fatal ? 'fatal' : 'error', e);
    const b = [...boundaries][0];
    if (fatal && b) {
      b.show(e instanceof Error ? e : new Error(String(e)));
      return; // handled: keep the app open
    }
    previous(e, fatal);
  });
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: brand.navy },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 16 },
  icon: { width: 72, height: 72, borderRadius: 24, backgroundColor: 'rgba(23,175,100,0.16)', alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  title: { color: '#FFFFFF', fontSize: 24, lineHeight: 30, fontWeight: '800', textAlign: 'center' },
  text: { color: '#D3E2F5', fontSize: 15.5, lineHeight: 23, textAlign: 'center' },
  btn: { minHeight: 50, borderRadius: 14, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: brand.green },
  btnText: { color: '#03213F', fontSize: 15.5, fontWeight: '800' },
});
