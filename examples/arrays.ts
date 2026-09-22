// Arrays across the host boundary (docs/wp8-interop.md). `Int32Array`,
// `Float64Array` and `BigInt64Array` are the Nish spellings of i32[],
// f64[] and i64[]: one layout, and the name a Node host sees in the typings.
//
//   nish examples/arrays.ts -o build/arrays.ll \
//     --emit-header build/arrays.h --emit-dts build/arrays.d.ts --emit-napi build/arrays_napi.c
//   scripts/build.sh build/arrays.ll runtime/runtime_wasm.c -o build/arrays.wasm --profile wasm
//   node examples/node-host.mjs build/arrays.wasm scale f64:1,2,3 2      # scale(...) = 2, 4, 6
//   scripts/build.sh build/arrays.ll runtime/runtime.c build/arrays_napi.c -o build/arrays.node --profile napi
//   node examples/node-addon.mjs build/arrays.node
//
// The types are spelled explicitly (i32 / f64) so the module means the same
// thing in both number modes.

/** Sum of a Float64Array: the host passes the whole buffer once. */
export const sumF64 = (xs: Float64Array): f64 => {
  let total: f64 = 0;
  for (const x of xs) {
    total += x;
  }
  return total;
};

export const sumI32 = (xs: Int32Array): i32 => {
  let total: i32 = 0;
  for (const x of xs) {
    total += x;
  }
  return total;
};

/** A new array: the host gets a copy (wasm) or a fresh typed array (N-API). */
export const scale = (xs: Float64Array, k: f64): Float64Array => {
  const out = new Float64Array(xs.length);
  for (let i = 0; i < xs.length; i++) {
    out[i] = xs[i] * k;
  }
  return out;
};

export const squares = (n: i32): Int32Array => {
  const out = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = i * i;
  }
  return out;
};

/** Writes through its parameter: the header spells it `nish_array *`, and the host's buffer changes in place. */
export const fill = (xs: Int32Array, v: i32): void => {
  for (let i = 0; i < xs.length; i++) {
    xs[i] = v;
  }
};

export const widen = (xs: Int32Array): BigInt64Array => {
  const out = new BigInt64Array(xs.length);
  for (let i = 0; i < xs.length; i++) {
    out[i] = toI64(xs[i]);
  }
  return out;
};

/** i64 in and out: JS passes a bigint. */
export const sumI64 = (xs: BigInt64Array): i64 => {
  let total: i64 = 0;
  for (const x of xs) {
    total += x;
  }
  return total;
};
