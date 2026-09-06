function scale(v: f64, k: f64): f64 {
  let r = v;
  r *= k;
  r += v;
  r /= k;
  return r;
}

function test(): number {
  let x = 10;
  x += 5;
  x -= 3;
  x *= 4;
  x /= 5;
  x %= 4;
  let y = 2;
  y += x += 1;
  return x * 100 + y;
}
