export function fmt(n: number, digits = 0): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

export function pct(n: number): number {
  return Math.max(0, Math.min(100, n * 100));
}

export function round5(n: number): number {
  return Math.round(n / 5) * 5;
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
