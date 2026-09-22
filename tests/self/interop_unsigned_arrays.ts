// The unsigned widths as *arrays* across the wasm and N-API boundaries
// (WP30), for `tests/self/interop_oracle.js`.
//
// `interop_unsigned.ts` is the scalar half and says it has no arrays, because
// that is what lets it link under `--profile wasm` with nothing but its own
// code. This is the other half, and it is a separate file for that reason
// rather than for tidiness: an array-taking module has to link
// `runtime/runtime_wasm.c` for the arena.
//
// The point being pinned is that the scalar boundary's masks have **no
// counterpart here**. A scalar `u32` result travels in an i32 value type and
// reaches JavaScript negative above 2^31 unless the loader writes `>>> 0`; an
// element never travels in a value type at all, so `Uint32Array` reading
// `data` is what restores the range, and a store through one truncates exactly
// as the language wraps. Each function below is a position where a generated
// mask would therefore be wrong rather than merely redundant:
//
//   sumU8       a borrowed `u8[]`, the shape a bytes-in parser takes: the
//               fixpoint proves no store, so the C header says `const`
//   fillU8      a `u8[]` the callee writes through, so the loader copies the
//               arena bytes back into the caller's Uint8Array after the call
//   highU8      an element above 2^7 read back out, where a `u8` *scalar*
//               result would need its mask
//   sumU16      the same borrow at the 2-byte width, where `data` is only
//               2-aligned and the view's offset has to divide by 2
//   maxU32      a u32 element above 2^31, the case the scalar path gets wrong
//               without `>>> 0`
//   sumU64      a u64 element above 2^63, which a BigUint64Array reads as the
//               large positive value rather than the negative bigint a scalar
//               `u64` result arrives as
//   countU8     a `u8[]` argument and an `i32` result, so the answer crosses
//               in a value type while the payload crosses in memory

export function sumU8(xs: u8[]): i32 {
  let total = 0;
  for (let i = 0; i < xs.length; i++) {
    total = total + toI32(xs[i]);
  }
  return total;
}

export function fillU8(xs: u8[], v: u8): void {
  for (let i = 0; i < xs.length; i++) {
    xs[i] = v;
  }
}

export function highU8(): u8[] {
  const out = new Array<u8>(2);
  out[0] = 200;
  out[1] = 255;
  return out;
}

export function sumU16(xs: u16[]): i32 {
  let total = 0;
  for (let i = 0; i < xs.length; i++) {
    total = total + toI32(xs[i]);
  }
  return total;
}

export function maxU32(): u32[] {
  const out = new Array<u32>(2);
  out[0] = 4294967295;
  out[1] = 2147483648;
  return out;
}

export function sumU64(xs: u64[]): u64 {
  let total: u64 = 0;
  for (let i = 0; i < xs.length; i++) {
    total = total + xs[i];
  }
  return total;
}

export function countU8(xs: u8[], needle: u8): i32 {
  let n = 0;
  for (let i = 0; i < xs.length; i++) {
    if (xs[i] === needle) {
      n = n + 1;
    }
  }
  return n;
}
