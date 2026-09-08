function bump(v: f64): f64 {
  let x = v;
  x++;
  --x;
  return ++x;
}

export function test(): number {
  let i = 5;
  const a = i++;
  const b = ++i;
  const c = i--;
  const d = --i;
  return a * 1000 + b * 100 + c * 10 + d + i;
}
