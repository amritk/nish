// i64: wrapping at 2^63, negative division and remainder, abs/min/max, conversions, printing.
function square(x: i64): i64 {
  return x * x;
}

function pow2(n: number): i64 {
  let r: i64 = 1;
  for (let i = 0; i < n; i++) {
    r *= 2;
  }
  return r;
}

export function main(): number {
  const big: i64 = 3000000000;
  console.log(big);
  console.log(square(big));
  console.log(square(big) * 2);
  console.log(square(square(big)));
  console.log(-big);
  console.log(big / 7);
  console.log(big % 7);
  console.log(-big / 7);
  console.log(-big % 7);
  console.log(big / -7);
  console.log(big % -7);
  const max = pow2(62) - 1 + pow2(62);
  const min = -max - 1;
  console.log(max);
  console.log(min);
  console.log(max + 1);
  console.log(min - 1);
  console.log(max * 2);
  console.log(min / 2);
  console.log(min % 10);
  console.log(Math.abs(min));
  console.log(Math.abs(min + 1));
  console.log(Math.abs(-big));
  console.log(Math.min(min, max));
  console.log(Math.max(min, max));
  console.log(Math.min(big, -big));
  console.log(min < max);
  console.log(min === max + 1);
  console.log(big !== square(big));
  console.log(toI64(2147483647) + 1);
  console.log(toI64(-2147483647 - 1) - 1);
  console.log(toI32(big));
  console.log(toI32(max));
  console.log(toI32(min));
  console.log(toF64(max));
  console.log(toF64(min));
  console.log(toF64(big) / 2);
  const e18: f64 = 1e18;
  console.log(toI64(e18) * 10);
  const mid: f64 = -1.5;
  console.log(toI64(mid));
  console.log(pow2(63));
  console.log(pow2(64));
  console.log(pow2(32) + pow2(31));
  let n: i64 = 1;
  for (let i = 1; i <= 25; i++) {
    n *= toI64(i);
  }
  console.log(n);
  console.log(`${big} ${-big} ${square(big)} ${min}`);
  let x: i64 = 5;
  x++;
  x += 10;
  x *= 1000000000;
  x -= 1;
  x /= 3;
  x %= 1000000;
  const y = x--;
  console.log(`${x} ${y}`);
  return 0;
}
