// Subject accents are tuned for large text / icons / borders (≥3:1). For SMALL
// status-bearing text (mastery %, scores, the correct quiz answer) two of the four
// subject accents fall below WCAG AA 4.5:1, so we lighten toward the body text:
// 75% accent / 25% --text clears AA for all four (itc/fred get slightly lighter,
// aleman/ciber reach ~5.1:1) while keeping the hue. Use the raw accent for big/icon.
export function readableAccent(accent: string): string {
  return `color-mix(in srgb, ${accent} 75%, var(--text))`;
}
