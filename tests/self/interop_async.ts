// A fixture for the WP24 A1 asynchronous N-API exports (`--emit-napi-async`,
// the interop section of `tests/run.js`) and for `tests/self/interop_oracle.js`.
//
// Four shapes in one file, because the flag's whole surface is which of them
// gets a `<name>Async` twin and which is named in the shim with a reason:
// `spin` is the long scalar call the flag exists for; `digest` is the one that
// *allocates* while it runs, so it proves the arena bracket the exec callback
// takes on the worker's own arena; `label` and `total` are the string and the
// borrowed-array shapes that stay synchronous, because the arena is per-thread
// and a typed array's bytes belong to the JS thread that lent them.

/** A long scalar call: a xorshift chain, so the loop is work LLVM cannot fold into a formula. */
export const spin = (rounds: i32): i32 => {
  let x: i32 = 123456789;
  let i: i32 = 0;
  while (i < rounds) {
    let j: i32 = 0;
    while (j < 1000) {
      x = x ^ (x << 13);
      x = x ^ (x >>> 17);
      x = x ^ (x << 5);
      j = j + 1;
    }
    i = i + 1;
  }
  return x;
};

/**
 * Scalar in, scalar out, and it allocates: every round builds a string in the
 * arena and drops it. Asynchronously that allocation happens on a libuv worker
 * thread, so what reclaims it is the `nish_arena_mark` / `nish_arena_release`
 * bracket the exec callback takes on that thread's own arena -- a worker is
 * reused between calls, so without the bracket its arena would only grow.
 * Only xor and small addends, so nothing here can overflow an `i32`.
 */
export const digest = (seed: i32, rounds: i32): i32 => {
  let acc: i32 = seed;
  let i: i32 = 0;
  while (i < rounds) {
    const s = `round-${i}-of-${seed}`;
    acc = acc ^ (s.length + i);
    i = i + 1;
  }
  return acc;
};

/**
 * A `void` result: the one asynchronous shape whose work item carries no
 * `result` field at all, and whose completion callback boxes `undefined`
 * without reading anything the worker wrote. Nothing here is worth computing;
 * the crossing is what is under test, as in `interop_widths.ts`.
 */
export const touch = (rounds: i32): void => {
  let i: i32 = 0;
  while (i < rounds) {
    i = i + 1;
  }
};

/** A string result: no `labelAsync`, because the string lives in the arena. */
export const label = (n: i32): string => `n=${n}`;

/** A borrowed typed array: no `totalAsync`, because the bytes are the caller's. */
export const total = (xs: Int32Array): i32 => {
  let sum: i32 = 0;
  for (const x of xs) {
    sum = sum ^ x;
  }
  return sum;
};
