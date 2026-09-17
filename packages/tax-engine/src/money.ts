/** All money math uses integer cents; euro output is rounded to 2 decimals. */

export function toCents(euros: number): number {
  return Math.round(euros * 100);
}

export function fromCents(cents: number): number {
  return Math.round(cents) / 100;
}

export function shareCents(cents: number, pct: number): number {
  return Math.round((cents * pct) / 100);
}
