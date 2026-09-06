// Typed-array aliases: Int32Array is i32[], Float64Array is f64[], BigInt64Array is i64[].
// They are the same StaticType as the element-typed array (one layout), so a
// Float64Array value is an ordinary f64[] argument and vice versa.
function sumI32(xs: Int32Array): i32 {
  let total: i32 = 0;
  for (const x of xs) {
    total += x;
  }
  return total;
}

function sumF64(xs: f64[]): f64 {
  let total: f64 = 0;
  for (const x of xs) {
    total += x;
  }
  return total;
}

function squares(n: i32): Int32Array {
  const out = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = i * i;
  }
  return out;
}

function scale(xs: Float64Array, k: f64): Float64Array {
  const out = new Float64Array(xs.length);
  for (let i = 0; i < xs.length; i++) {
    out[i] = xs[i] * k;
  }
  return out;
}

function widen(xs: Int32Array): BigInt64Array {
  const out = new BigInt64Array(xs.length);
  for (let i = 0; i < xs.length; i++) {
    out[i] = toI64(xs[i]);
  }
  return out;
}

export function main(): number {
  const sq = squares(5);
  console.log(sumI32(sq));
  const ws = new Float64Array(3);
  ws[0] = 0.5;
  ws[1] = 1.5;
  ws[2] = 2.5;
  const k: f64 = 2;
  console.log(sumF64(scale(ws, k)));
  const big = widen(sq);
  console.log(big[4] * 1000000000000);
  console.log(sq.length);
  return 0;
}
