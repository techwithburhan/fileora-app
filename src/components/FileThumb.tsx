/** Small preview: first page of a PDF (Android PdfRenderer), the image itself, or a type icon. */
import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import PdfThumbnail from 'react-native-pdf-thumbnail';
import Icon from './Icon';
import { kindOf } from '../store/files';
import { Theme } from '../theme';

const cache = new Map<string, string>();

export default function FileThumb({ path, mime, name, theme, size = 52 }: { path: string; mime: string; name: string; theme: Theme; size?: number }) {
  const kind = kindOf(mime, name);
  const uri = path.startsWith('/') ? `file://${path}` : path;
  const [thumb, setThumb] = useState<string | null>(kind === 'image' ? uri : (cache.get(path) ?? null));

  useEffect(() => {
    let live = true;
    if (kind !== 'pdf' || cache.has(path)) return;
    PdfThumbnail.generate(uri, 0, { maxWidth: 160, quality: 70 })
      .then(r => {
        cache.set(path, r.uri);
        if (live) setThumb(r.uri);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [kind, path, uri]);

  const box = { width: size, height: Math.round(size * 1.25), backgroundColor: theme.surface2, borderColor: theme.line };
  if (thumb) {
    return (
      <View style={[styles.box, box]}>
        <Image source={{ uri: thumb }} style={styles.img} resizeMode={kind === 'image' ? 'cover' : 'contain'} />
      </View>
    );
  }
  return (
    <View style={[styles.box, box, styles.center]}>
      <Icon name={kind === 'pdf' ? 'pdf' : kind === 'image' ? 'image' : 'file'} size={Math.round(size * 0.45)} color={theme.muted} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: 10, borderWidth: 1, overflow: 'hidden' },
  img: { width: '100%', height: '100%', backgroundColor: '#fff' },
  center: { alignItems: 'center', justifyContent: 'center' },
});
