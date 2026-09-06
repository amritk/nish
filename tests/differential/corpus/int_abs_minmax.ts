// Math.abs wraps at INT_MIN (llvm.abs with poison off); min/max are signed compares.
function clamp(x: number, lo: number, hi: number): number {
  return Math.min(Math.max(x, lo), hi);
}

export function main(): number {
  const min = -2147483647 - 1;
  console.log(Math.abs(min));
  console.log(Math.abs(min + 1));
  console.log(Math.abs(-1));
  console.log(Math.abs(0));
  console.log(Math.abs(2147483647));
  console.log(Math.min(min, 2147483647));
  console.log(Math.max(min, 2147483647));
  console.log(Math.min(-5, -6));
  console.log(Math.max(-5, -6));
  console.log(Math.min(3, 3));
  console.log(clamp(1000, -10, 10));
  console.log(clamp(-1000, -10, 10));
  console.log(clamp(7, -10, 10));
  console.log(clamp(min, -10, 10));
  let best = min;
  let worst = 2147483647;
  for (let i = -20; i < 20; i += 3) {
    const v = i * i * i - 50 * i;
    best = Math.max(best, v);
    worst = Math.min(worst, v);
  }
  console.log(best);
  console.log(worst);
  console.log(Math.abs(best - worst));
  return 0;
}
