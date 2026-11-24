/** Small colour helpers for festival accents: contrast-safe text and icon colours. */

function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function toHex([r, g, b]: [number, number, number]): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}

/** WCAG relative luminance. */
export function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map(v => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

/** a mixed with b (t = 0 → a, 1 → b). */
export function mix(a: string, b: string, t: number): string {
  const [p, q] = [rgb(a), rgb(b)];
  return toHex([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t]);
}

/** The accent moved towards black (light background) or white (dark background) until it reaches the contrast. */
export function readableOn(accent: string, bg: string, min = 4.5): string {
  const toward = luminance(bg) > 0.4 ? '#000000' : '#FFFFFF';
  for (let t = 0; t <= 1.0001; t += 0.05) {
    const c = mix(accent, toward, t);
    if (contrast(c, bg) >= min) return c;
  }
  return toward;
}

/** White or dark navy text, whichever reads better on the colour. */
export function textOn(colour: string): string {
  return contrast('#FFFFFF', colour) >= contrast('#03213F', colour) ? '#FFFFFF' : '#03213F';
}
