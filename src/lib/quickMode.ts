/** 1.2.4: quick-tile layout, so no name is cut mid-word. Width of a word ≈ letters × 0.62 × font size (bold 13.5). */
export function quickMode(cell: number | string, names: string[], fontScale: number): 'row' | 'narrow' | 'one' {
  if (typeof cell !== 'number' || cell <= 0) return 'row';
  const longest = Math.max(0, ...names.flatMap(n => n.split(/[\s-]+/).map(w => w.length)));
  const word = longest * 0.62 * 13.5 * (fontScale || 1);
  if (cell >= 150 && word <= cell - 66) return 'row'; // icon beside the name, as before
  if (word <= cell - 22) return 'narrow';
  return 'one';
}
