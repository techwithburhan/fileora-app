import { quickMode } from '../src/lib/quickMode';

const EN = ['Merge PDF', 'Compress PDF', 'PDF to Word', 'Sign PDF', 'JPG to PDF', 'Aadhaar Card Print'];
const DE = ['PDF zusammenführen', 'PDF komprimieren', 'PDF in Word', 'PDF signieren', 'JPG in PDF', 'Aadhaar-Karte drucken'];

describe('quick tools layout (Home)', () => {
  it('keeps the icon beside the name on normal phones, as before', () => {
    expect(quickMode(170, EN, 1)).toBe('row');
    expect(quickMode(160, EN, 1)).toBe('row');
  });
  it('puts the icon above the name on narrow tiles', () => {
    expect(quickMode(141, EN, 1)).toBe('narrow'); // 360 dp phone
    expect(quickMode(121, EN, 1)).toBe('narrow'); // 320 dp phone
  });
  it('uses one tile per row when a word would be cut (small screen, large display)', () => {
    expect(quickMode(84, EN, 1)).toBe('one');
    expect(quickMode(121, DE, 1)).toBe('one'); // "zusammenführen" on a 320 dp phone
    expect(quickMode(141, EN, 1.6)).toBe('narrow'); // large text still fits above-icon tiles
    expect(quickMode(141, EN, 2)).toBe('one'); // largest text
  });
  it('lays out normally before the first measurement', () => {
    expect(quickMode('48%', EN, 1)).toBe('row');
  });
});
