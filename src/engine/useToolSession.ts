/**
 * One open tool in the offline engine: its definition (options, accepted files…), the live state
 * the tool's own code computes (what to show, help texts, "ready to run" and its hint), and the
 * file / page / region previews.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { call, EngineError, on, onReset, sendFile, ToolDef, ToolState, whenReady } from './engine';
import type { Picked } from '../lib/pick';

export type Opened = { sid: string; def: ToolDef; state: ToolState };
export type SessionFile = Picked & { fid: string };

/** Files above this size go to a server tool without passing through the engine (no preview). */
const SERVER_PREVIEW_MAX = 30 * 1048576;

export function useToolSession(tool: { id: string; name: string; desc: string; exec: string }, preset?: unknown) {
  const [def, setDef] = useState<ToolDef | null>(null);
  const [state, setState] = useState<ToolState | null>(null);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState<{ f: number; label: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [restarts, setRestarts] = useState(0);
  const sid = useRef<string | null>(null);
  const files = useRef(new Map<string, SessionFile>()); // fid → the app's copy of the file

  useEffect(() => {
    let live = true;
    let off: (() => void) | null = null;
    setError(null);
    (async () => {
      try {
        await whenReady();
        const o = await call<Opened>('open', {
          tool: tool.id,
          name: tool.name,
          desc: tool.desc,
          runs: tool.exec === 'server' ? 'server' : undefined,
          maxFiles: 20,
          maxFileMB: 100,
          preset,
        });
        if (!live) {
          call('close', { sid: o.sid }).catch(() => {});
          return;
        }
        sid.current = o.sid;
        off = on(o.sid, e => {
          if (e.ev === 'state') setState(e.state);
          else if (e.ev === 'thumb') setThumbs(t => ({ ...t, [e.key]: e.url }));
          else if (e.ev === 'progress') setProgress({ f: e.f, label: e.label });
        });
        files.current.clear();
        setThumbs({});
        setDef(o.def);
        setState(o.state);
      } catch (e) {
        if (live) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      live = false;
      off?.();
      if (sid.current) call('close', { sid: sid.current }).catch(() => {});
      sid.current = null;
    };
  }, [tool.id, tool.name, tool.desc, tool.exec, preset, restarts]);

  // the engine page restarted (low memory): open the tool again, the files have to be added again
  useEffect(
    () =>
      onReset(() => {
        sid.current = null;
        setRestarts(n => n + 1);
      }),
    [],
  );

  const need = () => {
    if (!sid.current) throw new EngineError('The tool is still starting. Try again in a moment.', true);
    return sid.current;
  };
  const apply = useCallback((s: ToolState | null | undefined) => {
    if (s && s.sid === sid.current) setState(s);
  }, []);

  /** Adds picked files: copies each into the engine, then lets the tool read them. */
  const addFiles = useCallback(
    async (picked: Picked[], onCopy?: (label: string) => void): Promise<string[]> => {
      const s = need();
      if (!def) return [];
      const fids: string[] = [];
      for (const [n, p] of picked.entries()) {
        const readable = /pdf|image|svg|heic|heif|html|text/i.test(p.mime) || /\.(pdf|jpe?g|png|webp|gif|bmp|avif|svg|heic|heif|html?|txt)$/i.test(p.name);
        const stub = def.server && (!readable || p.size > SERVER_PREVIEW_MAX);
        onCopy?.(picked.length > 1 ? `Opening ${n + 1} of ${picked.length}…` : 'Opening the file…');
        const fid = await sendFile(p.path, p.name, p.mime, p.size, stub);
        files.current.set(fid, { ...p, fid });
        fids.push(fid);
      }
      const r = await call<{ notes: string[]; state: ToolState }>('addFiles', { sid: s, fids });
      apply(r.state);
      return r.notes;
    },
    [def, apply],
  );
  const setOpt = useCallback(
    async (fid: string, value: unknown) => {
      apply(await call<ToolState>('setOpt', { sid: need(), fid, value }));
    },
    [apply],
  );
  const setItems = useCallback(
    async (order: string[]) => {
      apply(await call<ToolState>('setItems', { sid: need(), order }));
    },
    [apply],
  );
  const setPages = useCallback(
    async (pages: { key: string; rot: number }[]) => {
      apply(await call<ToolState>('setPages', { sid: need(), pages }));
    },
    [apply],
  );
  const setRegions = useCallback(
    async (regions: unknown) => {
      apply(await call<ToolState>('setRegions', { sid: need(), regions }));
    },
    [apply],
  );
  /** Signature: draw (strokes), type (text) or a photo (picked file); null clears it. */
  const signature = useCallback(
    async (fid: string, v: { mode: 'draw'; strokes: number[][][]; ink: string } | { mode: 'type'; text: string; ink: string } | { mode: 'upload'; file: Picked } | null) => {
      const s = need();
      let args: Record<string, unknown> = { sid: s, fid, mode: 'clear' };
      if (v?.mode === 'upload') args = { sid: s, fid, mode: 'upload', file: await sendFile(v.file.path, v.file.name, v.file.mime, v.file.size) };
      else if (v) args = { sid: s, fid, ...v };
      apply(await call<ToolState>('signature', args));
    },
    [apply],
  );
  const setImage = useCallback(
    async (fid: string, file: Picked | null) => {
      const s = need();
      const f = file ? await sendFile(file.path, file.name, file.mime, file.size) : null;
      apply(await call<ToolState>('setImage', { sid: s, fid, file: f }));
    },
    [apply],
  );
  const fileFor = useCallback((fid: string) => files.current.get(fid), []);

  return { sid, def, state, thumbs, progress, setProgress, error, addFiles, setOpt, setItems, setPages, setRegions, signature, setImage, fileFor };
}
