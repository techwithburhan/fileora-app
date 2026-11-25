/**
 * Engine self-test, for checking a build on a phone or in the CI simulator/emulator:
 * open fileora://selftest (adb: am start -a android.intent.action.VIEW -d fileora://selftest;
 * iOS simulator: xcrun simctl openurl booted fileora://selftest).
 *
 * 1. the app → engine → app path: a picture file goes in, a PDF comes back to a file
 * 2. the engine runs a set of tools on files it makes itself
 * The result is shown on screen and written to the log as one "FILEORA_SELFTEST {…}" line.
 *
 * fileora://tool/<id> opens a tool's screen (CI screenshots). On iOS the simulator asks before it
 * opens a link, so CI starts the app with launch arguments instead: -FileoraSelfTest 1, -FileoraTool <id>.
 */
import React, { useEffect, useState } from 'react';
import { Linking, Modal, Platform, ScrollView, Settings, StyleSheet, View } from 'react-native';
import Text from '../i18n/Text';
import BlobUtil from 'react-native-blob-util';
import { call, readOutput, sendFile, ToolState, Output } from './engine';
import PressableScale from '../components/PressableScale';
import { brand } from '../theme';
import { navigationRef } from '../navigation/types';
import { toolById } from '../data/tools';
import { LANGS, setLang, LangCode } from '../i18n/i18n';
import { store } from '../store/store';
import { saveResult } from '../lib/output';
import { remote } from '../remote/remote';
import { inbox } from '../remote/inbox';
import { showBanner } from '../components/InAppBanner';
import DEMO_FESTIVALS from '../festival/demoFestivals.json';
import { cleanFx } from '../festival/fxData';
import type { Festival } from '../remote/remote';

/** A sample festival for CI screenshots (plugin 2.24 data); a new version each time so the animation plays. */
function demoFestival(d: Record<string, unknown>): Festival {
  return {
    id: String(d.id),
    v: `demo${Date.now()}`,
    name: String(d.name),
    greeting: String(d.greeting),
    sub: String(d.sub ?? ''),
    builtin: false,
    design: String(d.design ?? ''),
    image: '',
    accent: String(d.accent),
    accent_dark: String(d.accent_dark ?? ''),
    ink: String(d.ink ?? '#FFFFFF'),
    animation: 'none',
    anim_secs: 8,
    anim_freq: 'open',
    link: '',
    fx: cleanFx(d.fx),
  };
}

const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAEAAAAAwCAIAAAAuKetIAAAAeElEQVR4Xu3ZsQ2AIBQGYTFuwgRW7mYsjTOxBSsZGweA4vIn9/WQ93J0lHq0JdmaPPzHBWgWoFmAZgGaBWjbzAD9vGaO//bnHr7HJ0SzAM0CNAvQLECzAM0CNAvQLECzAM0CtPgCxT8yWPwTcgGaBWgWoFmAFl/gBeCDBYUf80jsAAAAAElFTkSuQmCC';

type Row = { tool: string; ok: boolean; ms: number; error?: string };
type Report = { ok: boolean; passed: number; total: number; ms: number; tools: number; transfer: string; rows: Row[] };

async function transferTest(): Promise<string> {
  const dir = BlobUtil.fs.dirs.CacheDir;
  const src = `${dir}/selftest-${Date.now()}.png`;
  const out = `${dir}/selftest-${Date.now()}.pdf`;
  await BlobUtil.fs.writeFile(src, PNG, 'base64');
  const open = await call<{ sid: string; state: ToolState }>('open', { tool: 'jpg2pdf', name: 'JPG to PDF' });
  try {
    const fid = await sendFile(src, 'selftest.png', 'image/png', 0);
    await call('addFiles', { sid: open.sid, fids: [fid] });
    for (let i = 0; i < 50; i++) {
      const st = await call<ToolState>('state', { sid: open.sid });
      if (st.items.every(x => x.ready) && st.ok) break;
      await new Promise<void>(r => setTimeout(() => r(), 100));
    }
    const r = await call<{ outputs: Output[] }>('run', { sid: open.sid });
    const o = r.outputs[0];
    await readOutput(o.oid, o.size, out);
    const b64 = await BlobUtil.fs.readFile(out, 'base64');
    const size = Number((await BlobUtil.fs.stat(out)).size);
    if (!b64.startsWith('JVBER')) throw new Error("the result isn't a PDF"); // "%PDF" in base64
    return `ok, ${size} bytes`;
  } finally {
    call('close', { sid: open.sid }).catch(() => {});
    BlobUtil.fs.unlink(src).catch(() => {});
    BlobUtil.fs.unlink(out).catch(() => {});
  }
}

export async function runSelfTest(): Promise<Report> {
  const t0 = Date.now();
  let transfer: string;
  try {
    transfer = await transferTest();
  } catch (e) {
    transfer = `FAILED: ${e instanceof Error ? e.message : String(e)}`;
  }
  const r = await call<{ ok: boolean; passed: number; total: number; tools: number; results: Row[] }>('selftest', {}, 300000);
  const rep: Report = { ok: r.ok && transfer.startsWith('ok'), passed: r.passed, total: r.total, ms: Date.now() - t0, tools: r.tools, transfer, rows: r.results };
  console.log(`FILEORA_SELFTEST ${JSON.stringify(rep)}`);
  return rep;
}

/** Three sample alerts for the CI screenshots (local only; ids start with "demo-"). */
function addDemoAlerts() {
  const t = Math.floor(Date.now() / 1000);
  const add = () => {
    inbox.add({ id: 'demo-1', title: 'Fileora 1.2 is here', body: 'Notifications now arrive in about a second, every alert opens with its whole message, and pull-to-refresh always shows the newest settings from the website. Open Settings → Notifications to choose what you get. This sample alert shows that long messages are never cut off: everything you write in App Center appears here in full, with the date, the time and the category.', image: '', open: 'update', tool: '', link: '', topic: 'updates', older: '', at: t - 120 });
    inbox.add({ id: 'demo-2', title: 'New tool: Compress to 100 KB', body: 'Shrink photos and PDFs to an exact size for forms.', image: '', open: 'tool', tool: 'compress', link: '', topic: 'tools', older: '', at: t - 3600 });
    inbox.add({ id: 'demo-3', title: 'Weekend offer', body: 'Ad-free for 7 days when you watch one short video.', image: '', open: 'home', tool: '', link: '', topic: 'offers', older: '', at: t - 86400 });
  };
  const wait = () => (remote.get().loaded ? add() : setTimeout(wait, 200));
  wait();
}

export default function SelfTest() {
  const [rep, setRep] = useState<Report | null>(null);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    const openTool = (id: string) => {
      if (!toolById(id)) return;
      setRep(null);
      setErr(null);
      const nav = () => (navigationRef.isReady() ? navigationRef.navigate('Process', { tool: id }) : setTimeout(nav, 300));
      nav();
    };
    const go = (url?: string | null) => {
      const tool = url ? /^fileora:\/\/tool\/([a-z0-9]+)/i.exec(url) : null;
      if (tool) return openTool(tool[1].toLowerCase());
      // app 1.1 (used by the CI screenshots): fileora://lang/hi switches the language,
      // fileora://screen/downloads opens Downloads.
      const lang = url ? /^fileora:\/\/lang\/([a-z]{2})/i.exec(url) : null;
      if (lang) {
        const code = lang[1].toLowerCase();
        // after the saved settings are read, or they would put the old language back
        const apply = () => (store.get().loaded ? setLang(code as LangCode) : setTimeout(apply, 200));
        if (LANGS.some(l => l.code === code)) apply();
        return;
      }
      // app 1.1.2 (CI screenshots): fileora://demo/result/5 shows the result screen of 5 sample files
      // (nothing is saved; the files don't exist), to check the layout and the party popper.
      const demo = url ? /^fileora:\/\/demo\/result\/(\d{1,3})/i.exec(url) : null;
      if (demo) {
        const n = Math.max(1, Math.min(120, Number(demo[1])));
        const open = () => (navigationRef.isReady() ? navigationRef.navigate('Process', { tool: 'compress', demo: n }) : setTimeout(open, 300));
        return open();
      }
      // app 1.2 (CI screenshots): fileora://setup shows the first-launch screen again, fileora://setup/done
      // closes it; fileora://demo/alerts adds three sample alerts (only on this phone) and opens Alerts,
      // fileora://demo/alert opens the first one, fileora://demo/banner shows the in-app banner.
      const setup = url ? /^fileora:\/\/setup(\/done)?/i.exec(url) : null;
      if (setup) {
        const apply = () => (remote.get().loaded ? remote.setPrefs({ onboarded: setup[1] ? Date.now() : 0 }) : setTimeout(apply, 200));
        return apply();
      }
      const demoAlert = url ? /^fileora:\/\/demo\/(alerts|alert|banner)/i.exec(url) : null;
      if (demoAlert) {
        const kind = demoAlert[1].toLowerCase();
        addDemoAlerts();
        const open = () =>
          navigationRef.isReady()
            ? kind === 'alerts'
              ? navigationRef.navigate('Tabs', { screen: 'Alerts' })
              : kind === 'alert'
                ? navigationRef.navigate('Alert', { id: 'demo-1' })
                : showBanner({ id: 'demo-2', title: 'New tool: Compress to 100 KB', body: 'Shrink photos and PDFs to an exact size for forms.', topic: 'tools', ms: 20000, onPress: () => navigationRef.navigate('Alert', { id: 'demo-2' }) })
            : setTimeout(open, 300);
        return open();
      }
      // app 1.2.3 (CI screenshots): fileora://demo/festival/<diwali|holi|onam|lunar-new-year> shows that
      // festival's banner and its own animation on Home (plugin 2.24 data; only on this phone, until
      // the next settings check)
      const fest = url ? /^fileora:\/\/demo\/festival\/([a-z-]{3,30})/i.exec(url) : null;
      if (fest) {
        const d = (DEMO_FESTIVALS as Record<string, Record<string, unknown>>)[fest[1].toLowerCase()];
        const show = () => {
          if (!navigationRef.isReady() || !remote.get().loaded) {
            setTimeout(show, 300);
            return;
          }
          navigationRef.navigate('Tabs', { screen: 'Home' });
          if (d) remote.demoFestival(demoFestival(d));
        };
        return show();
      }
      // app 1.2.2 (CI screenshots): fileora://screen/updates opens Settings → App updates,
      // fileora://screen/settings the Settings tab
      // app 1.2.4: fileora://screen/files and fileora://screen/home open those tabs
      const scr = url ? /^fileora:\/\/screen\/(updates|settings|files|home)/i.exec(url) : null;
      if (scr) {
        const which = scr[1].toLowerCase();
        const open = () =>
          navigationRef.isReady()
            ? which === 'updates'
              ? navigationRef.navigate('Update')
              : navigationRef.navigate('Tabs', { screen: which === 'files' ? 'Files' : which === 'home' ? 'Home' : 'Settings' })
            : setTimeout(open, 300);
        open();
        return;
      }
      // app 1.2.4 (CI): fileora://demo/files saves 3 small sample files in Fileora (to try Files → Delete all)
      if (url && /^fileora:\/\/demo\/files/i.test(url)) {
        const add = async () => {
          if (!store.get().loaded) {
            setTimeout(add, 300);
            return;
          }
          for (let i = 1; i <= 3; i++) {
            const tmp = `${BlobUtil.fs.dirs.CacheDir}/sample-${i}-${Date.now()}.txt`;
            await BlobUtil.fs.writeFile(tmp, `Fileora sample file ${i}\n`.repeat(40 * i), 'utf8');
            await saveResult({ name: `sample-${i}.txt`, fromPath: tmp, move: true, mime: 'text/plain', publish: false });
          }
          if (navigationRef.isReady()) navigationRef.navigate('Tabs', { screen: 'Files' });
        };
        add().catch(() => {});
        return;
      }
      if (url && /^fileora:\/\/screen\/downloads/i.test(url)) {
        const open = () => (navigationRef.isReady() ? navigationRef.navigate('Activity', { tab: 'downloaded' }) : setTimeout(open, 300));
        open();
        return;
      }
      if (!url || !/^fileora:\/\/selftest/i.test(url)) return;
      setRunning(true);
      setErr(null);
      runSelfTest()
        .then(setRep, e => {
          const m = e instanceof Error ? e.message : String(e);
          console.log(`FILEORA_SELFTEST ${JSON.stringify({ ok: false, error: m })}`);
          setErr(m);
        })
        .finally(() => setRunning(false));
    };
    Linking.getInitialURL()
      .then(go)
      .catch(() => {});
    if (Platform.OS === 'ios') {
      const su = Settings.get('FileoraSetup');
      if (typeof su === 'string' && su) go(su === 'done' ? 'fileora://setup/done' : 'fileora://setup');
      const da = Settings.get('FileoraDemo');
      if (typeof da === 'string' && da) go(`fileora://demo/${da}`);
      if (Settings.get('FileoraSelfTest')) go('fileora://selftest');
      const t = Settings.get('FileoraTool');
      if (typeof t === 'string' && t) go(`fileora://tool/${t}`);
      const l = Settings.get('FileoraLang');
      if (typeof l === 'string' && l) go(`fileora://lang/${l}`);
      const sc = Settings.get('FileoraScreen');
      if (typeof sc === 'string' && sc) go(`fileora://screen/${sc}`);
    }
    const sub = Linking.addEventListener('url', e => go(e.url));
    return () => sub.remove();
  }, []);
  const close = () => {
    setRep(null);
    setErr(null);
  };
  if (!running && !rep && !err) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <View style={styles.scrim}>
        <View style={styles.card}>
          <Text style={styles.title}>Engine self-test</Text>
          {running && <Text style={styles.line}>Running…</Text>}
          {err && <Text style={[styles.line, styles.bad]}>Failed: {err}</Text>}
          {rep && (
            <>
              <Text style={[styles.big, rep.ok ? styles.good : styles.bad]}>
                {rep.ok ? 'PASSED' : 'FAILED'} · {rep.passed}/{rep.total} tools · {(rep.ms / 1000).toFixed(1)} s
              </Text>
              <Text style={styles.line}>
                {rep.tools} tools in the engine · file transfer: {rep.transfer}
              </Text>
              <ScrollView style={styles.list}>
                {rep.rows.map(r => (
                  <Text key={r.tool} style={[styles.row, r.ok ? styles.good : styles.bad]}>
                    {r.ok ? '✓' : '✗'} {r.tool} {r.ms} ms {r.error ?? ''}
                  </Text>
                ))}
              </ScrollView>
            </>
          )}
          {!running && (
            <PressableScale onPress={close} accessibilityRole="button" style={styles.btn}>
              <Text style={styles.btnText}>Close</Text>
            </PressableScale>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(2,11,23,0.6)', justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 18, gap: 8, maxHeight: '85%' },
  title: { fontSize: 20, fontWeight: '800', color: brand.navy },
  big: { fontSize: 17, fontWeight: '800' },
  line: { fontSize: 13.5, color: '#26466F' },
  list: { maxHeight: 360 },
  row: { fontSize: 13, fontFamily: 'monospace', paddingVertical: 1 },
  good: { color: '#0F7F49' },
  bad: { color: '#C42B31' },
  btn: { backgroundColor: brand.green, borderRadius: 14, minHeight: 46, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  btnText: { fontSize: 15, fontWeight: '800', color: '#03213F' },
});
