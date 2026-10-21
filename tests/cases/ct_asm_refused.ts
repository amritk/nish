// WP34 N6: functions written to fail the assembly check in tests/run.js, one
// for each rule it enforces, each compiled for both targets. A check that
// silently read nothing would pass everything; this fixture is how the suite
// knows it can fail. `SEEDED` in tests/ct-asm.js is the list it must keep.
// ct-check: naiveEqual secret=contents expect=branch
// ct-check: indexedLookup secret=secret expect=load
// ct-check: indexedStore secret=secret expect=load
// ct-check: unreadCall secret=secret expect=call
// ct-check: secretText secret=secret expect=call
// ct-check: callsLeak secret=secret expect=load via=leakyRow
// ct-check: tailLeak secret=secret expect=load via=leakyRow
// ct-check: secretDivide secret=secret expect=latency
// ct-check: leakyBaseRead secret=digit expect=load
// ct-check: leakyDivstep secret=zeta,f0,g0 expect=branch

import { uncheckedGet, uncheckedSet, wrappingAdd, wrappingMul } from "nish:unsafe";

// The comparison `===` gives: it stops at the first differing byte, so its
// running time says how many leading bytes matched.
export const naiveEqual = (a: u8[], b: u8[]): u32 => {
  for (let i: i32 = 0; i < 32; i++) {
    if (uncheckedGet(a, i) !== uncheckedGet(b, i)) {
      return 0;
    }
  }
  return 0xffffffff;
};

// A table indexed by a secret: which cache line is read says which entry.
export const indexedLookup = (table: u32[], secret: u32): u32 => uncheckedGet(table, toI32(secret & 15));

// The same for a write: which cache line is written says which entry.
export const indexedStore = (table: u32[], secret: u32): void => {
  uncheckedSet(table, toI32(secret & 15), 1);
};

// Two calls into the runtime (the arena's mark and the number's text), which
// the check does not read, so it cannot say what they do with the secret.
export const unreadCall = (secret: u32): u32 => {
  const text: string = `${secret}`;
  return secret ^ toU32(text.length);
};

// The same as a tail call: `jmp` and `b` to a symbol leave the function.
export const secretText = (secret: u32): string => `${secret}`;

// A leak the caller does not hold itself: twelve secret-indexed reads, written
// out so the body is long enough that `clang -O2` keeps it a function of its
// own and the two below call it, on both targets. `via=leakyRow` makes the
// check find the leak inside the call it followed; if LLVM ever inlines this,
// the leak is found outside it and the check fails, rather than passing
// without following anything.
export const leakyRow = (table: u32[], secret: u32): u32 => {
  let acc: u32 = secret;
  acc = (acc * 2654435761) ^ (acc >> 13) ^ uncheckedGet(table, toI32(acc & 15));
  acc = (acc * 2654435761) ^ (acc >> 13) ^ uncheckedGet(table, toI32((acc + 1) & 15));
  acc = (acc * 2654435761) ^ (acc >> 13) ^ uncheckedGet(table, toI32((acc + 2) & 15));
  acc = (acc * 2654435761) ^ (acc >> 13) ^ uncheckedGet(table, toI32((acc + 3) & 15));
  acc = (acc * 2654435761) ^ (acc >> 13) ^ uncheckedGet(table, toI32((acc + 4) & 15));
  acc = (acc * 2654435761) ^ (acc >> 13) ^ uncheckedGet(table, toI32((acc + 5) & 15));
  acc = (acc * 2654435761) ^ (acc >> 13) ^ uncheckedGet(table, toI32((acc + 6) & 15));
  acc = (acc * 2654435761) ^ (acc >> 13) ^ uncheckedGet(table, toI32((acc + 7) & 15));
  acc = (acc * 2654435761) ^ (acc >> 13) ^ uncheckedGet(table, toI32((acc + 8) & 15));
  acc = (acc * 2654435761) ^ (acc >> 13) ^ uncheckedGet(table, toI32((acc + 9) & 15));
  acc = (acc * 2654435761) ^ (acc >> 13) ^ uncheckedGet(table, toI32((acc + 10) & 15));
  acc = (acc * 2654435761) ^ (acc >> 13) ^ uncheckedGet(table, toI32((acc + 11) & 15));
  return acc;
};

// Calls the leak four times, and is otherwise straight-line and public-indexed.
export const callsLeak = (table: u32[], secret: u32): u32 =>
  leakyRow(table, secret) ^ leakyRow(table, secret + 1) ^ leakyRow(table, secret + 2) ^ leakyRow(table, secret + 3);

// Hands the leak a secret in a tail call: `jmp leakyRow` and `b leakyRow`.
export const tailLeak = (table: u32[], secret: u32): u32 => leakyRow(table, secret ^ 1);

// A divide takes as long as its operands say; `| 1` keeps the divisor from
// being zero, so the divide is the whole of the function, with no check.
export const secretDivide = (a: u32, secret: u32): u32 => a / (secret | 1);

// The comb table read std/crypto/p256.ts's p256BaseSelect replaces: entry
// `digit` of sub-table `c` read straight at the offset it names, X and Y. Which
// cache lines are read says which entry, and so four bits of the scalar.
export const leakyBaseRead = (out: u32[], table: u32[], c: i32, digit: u32): void => {
  const at: i32 = wrappingAdd(wrappingMul(c, 240), toI32(((digit & 15) - 1) & 15) * 16);
  for (let i: i32 = 0; i < 16; i++) {
    uncheckedSet(out, i, uncheckedGet(table, wrappingAdd(at, i)));
  }
};

// The divstep std/crypto/p256.ts's p256Divsteps30 replaces with masks: one step
// that tests g's low bit and zeta's sign with an `if`, the variable-time form of
// the safegcd step. Which way it goes is a bit of the nonce's inverse in the
// making, and the time it takes says which.
export const leakyDivstep = (zeta: u32, f0: u32, g0: u32, t: u32[]): u32 => {
  let z: u32 = zeta;
  let f: u32 = f0;
  let g: u32 = g0;
  let u: u32 = uncheckedGet(t, 0);
  let v: u32 = uncheckedGet(t, 1);
  let q: u32 = uncheckedGet(t, 2);
  let r: u32 = uncheckedGet(t, 3);
  if ((g & 1) !== 0) {
    if (toI32(z) < 0) {
      const tf: u32 = f;
      const tu: u32 = u;
      const tv: u32 = v;
      f = g;
      u = q;
      v = r;
      g = g - tf;
      q = q - tu;
      r = r - tv;
      z = 0 - z - 2;
    } else {
      g = g + f;
      q = q + u;
      r = r + v;
      z = z - 1;
    }
  } else {
    z = z - 1;
  }
  uncheckedSet(t, 0, u << 1);
  uncheckedSet(t, 1, v << 1);
  uncheckedSet(t, 2, q);
  uncheckedSet(t, 3, r);
  return z ^ f ^ (g >> 1);
};
