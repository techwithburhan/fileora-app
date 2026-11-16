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
import { Linking, Modal, Platform, ScrollView, Settings, StyleSheet, Text, View } from 'react-native';
import BlobUtil from 'react-native-blob-util';
import { call, readOutput, sendFile, ToolState, Output } from './engine';
import PressableScale from '../components/PressableScale';
import { brand } from '../theme';
import { navigationRef } from '../navigation/types';
import { toolById } from '../data/tools';

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
      if (Settings.get('FileoraSelfTest')) go('fileora://selftest');
      const t = Settings.get('FileoraTool');
      if (typeof t === 'string' && t) go(`fileora://tool/${t}`);
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
