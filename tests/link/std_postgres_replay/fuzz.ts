// The mutations the replay's fuzz applies to a recorded server answer, from a
// seeded xorshift32, so the run is the same on every machine. The same
// generator and mutations as tests/link/std_json_tokenizer/fuzz.ts.

/** xorshift32 (Marsaglia, 2003), public domain: the next state. */
export const pgXorshift = (x: i32): i32 => {
  let s: i32 = x;
  s = s ^ (s << 13);
  s = s ^ (s >>> 17);
  s = s ^ (s << 5);
  return s;
};

/** A value in `[0, n)` from a state. */
export const pgBelow = (state: i32, n: i32): i32 => {
  const r: i32 = (state >>> 1) % n;
  return r < 0 ? 0 : r;
};

/** `bytes` with one mutation, chosen by `a`: a bit flipped, a byte inserted or deleted, or the rest cut off. */
export const pgMutate = (bytes: u8[], a: i32, b: i32, c: i32): u8[] => {
  const n: i32 = toI32(bytes.length);
  const out: u8[] = [];
  const kind: i32 = pgBelow(a, 4);
  const at: i32 = n === 0 ? 0 : pgBelow(b, n + 1);
  for (let i: i32 = 0; i < n; i++) {
    const byte: i32 = toI32(bytes[i]);
    if (i === at && kind === 0) {
      out.push(toU8(byte ^ (1 << pgBelow(c, 8))));
    } else if (i === at && kind === 1) {
      out.push(toU8(pgBelow(c, 256)));
      out.push(toU8(byte));
    } else if (i === at && kind === 2) {
      // Deleted.
    } else if (i >= at && kind === 3) {
      break;
    } else {
      out.push(toU8(byte));
    }
  }
  if (at === n && kind === 1) {
    out.push(toU8(pgBelow(c, 256)));
  }
  return out;
};
