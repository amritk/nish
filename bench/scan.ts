// The shape of a bytes-in validator, for measuring the boundary around it
// (bench/worker.mjs). This is not a JSON parser and is not trying to be: it is
// the hot loop such a parser has — one pass over `u8[]` with a string/escape
// state machine and a depth counter — so that a boundary measurement is taken
// around a realistic amount of per-byte work rather than around a no-op.
//
// `u8[]` is the interesting part. The language has it today and it lowers to
// the same `%struct.nish_array*` every other array does, so the arena holds a
// byte buffer with `nish_alloc_array(1, n)` and nothing in the runtime has to
// change. What is missing is the interop generator's row for it: `--emit-dts`
// reports a `u8[]` parameter as not exported and writes no loader entry, so a
// host has to build the header itself (bench/worker.mjs does, and says so).

/** Tokens the scanner counts, and the error codes it answers instead. */
const ERR_DEPTH: i32 = -1;
const ERR_UNTERMINATED: i32 = -2;
const MAX_DEPTH: i32 = 64;

/**
 * One pass over `bytes`, answering the number of structural tokens found, or a
 * negative error code for input that cannot be valid JSON at all.
 *
 * The state machine is the one a validator cannot avoid: inside a string, a
 * byte is data and only `\` and `"` matter; outside one, brackets move the
 * depth and everything else is a value byte. Counting tokens rather than
 * building a tape keeps this honest as a proxy — the tape stores are a handful
 * of `i32` writes on top, and measuring them belongs with the real parser.
 */
export function scanJson(bytes: u8[]): i32 {
  let tokens = 0;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (inString) {
      // An escape consumes exactly the next byte, whatever it is, so a `\"`
      // does not close the string and a `\\` does not escape the quote after it.
      if (escaped) {
        escaped = false;
      } else if (b === 92) {
        escaped = true;
      } else if (b === 34) {
        inString = false;
        tokens = tokens + 1;
      }
    } else if (b === 34) {
      inString = true;
    } else if (b === 123 || b === 91) {
      depth = depth + 1;
      // A depth cap is a validator's obligation rather than a nicety: without
      // one, a document of nothing but `[` recurses as deep as the input is
      // long, which is the cheapest denial of service a parser can offer.
      if (depth > MAX_DEPTH) return ERR_DEPTH;
      tokens = tokens + 1;
    } else if (b === 125 || b === 93) {
      depth = depth - 1;
      if (depth < 0) return ERR_DEPTH;
      tokens = tokens + 1;
    } else if (b === 44 || b === 58) {
      tokens = tokens + 1;
    }
  }
  if (inString || depth !== 0) return ERR_UNTERMINATED;
  return tokens;
}

/**
 * The same pass, stopping at the first byte that proves the document invalid.
 * `scanJson` is the `validate` mode and this is `guard`: the interesting
 * difference at the boundary is that the answer is one `i32` either way, so
 * neither mode marshals anything on the way out.
 */
export function isJsonShaped(bytes: u8[]): boolean {
  return scanJson(bytes) >= 0;
}
