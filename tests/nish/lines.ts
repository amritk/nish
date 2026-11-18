/**
 * The runner's line split: `std/text`'s `splitLines`, sixteen positions at a
 * time with `nish:simd`.
 *
 * It lives here rather than in `std/text` because the compiler records every
 * `nish:simd` load as an index site it cannot prove, so a `std/text` that used
 * one would make every `--deny-panics` caller of `splitLines` fail to build.
 * The runner is not built with `--deny-panics`, and it splits every golden and
 * every captured output it reads, which is what this speeds up.
 * `tests/link/std_text_split_lines_simd` pins it against `splitLines`.
 */
import { bitmask, eq, loadU8x16, splatU8x16 } from "nish:simd";

const NEWLINE: i32 = 10;
/** Positions copied per chunk: the length of the flag buffer. */
const CHUNK: i32 = 4096;

/**
 * The lines of `text`, split at `\n` exactly as `std/text`'s `splitLines`
 * splits them: no trailing empty line after a final newline, and a `\r\n`
 * line keeps its `\r`.
 *
 * The text is copied, 4096 positions at a time, as one flag byte per position
 * into a buffer the lane-wise compare reads sixteen flags at a time: a string
 * has no lane-wise load of its own. A flag rather than the character, so that
 * a UTF-16 unit under Node whose low byte is 10 is not taken for a newline.
 *
 * @param text The text to split; an empty one has no lines.
 * @returns A fresh array of the lines, in order.
 */
export const splitLinesLanes = (text: string): string[] => {
  const length: i32 = toI32(text.length);
  const lines: string[] = [];
  const flags: u8[] = new Array<u8>(CHUNK);
  const one = splatU8x16(1);
  let start: i32 = 0;
  let base: i32 = 0;
  // `base` is where the chunk starts. Its bound leaves room for `base + 4095`
  // below `2 ** 31`; the scalar loop after this one takes any text past it.
  while (base >= 0 && base < length && base <= 2147479551) {
    let n: i32 = 0;
    let end: i32 = base;
    while (end >= 0 && end < length && n >= 0 && n < toI32(flags.length)) {
      flags[n] = toU8(toI32(text.charCodeAt(end)) === NEWLINE ? 1 : 0);
      end += 1;
      n += 1;
    }
    let i: i32 = 0;
    while (i >= 0 && i <= 4080 && i <= n - 16) {
      // Each set bit is one newline in these sixteen flags, lowest first. The
      // length test always holds; it is what removes the load's check. The
      // masks keep `bits` and `lane` in ranges the overflow prover can see.
      let bits: i32 = 0;
      if (i <= toI32(flags.length) - 16) {
        bits = bitmask(eq(loadU8x16(flags, i), one)) & 0xffff;
      }
      while (bits !== 0) {
        const lane: i32 = (31 - toI32(Math.clz32(bits & (0 - bits)))) & 15;
        const at: i32 = base + i + lane;
        // `start` is never negative and never passes `at`, which is below
        // `length`, so this always holds: it is what proves both bounds
        // within `text` and `at + 1` free of overflow.
        if (start >= 0 && start < length && at >= 0 && at < length) {
          lines.push(text.substring(start, at));
          start = at + 1;
        }
        bits = bits & (bits - 1) & 0xffff;
      }
      i += 16;
    }
    // The chunk's last fewer-than-sixteen flags, one at a time; the tests
    // always hold, as above.
    while (i >= 0 && i < CHUNK && i < n && i < toI32(flags.length)) {
      if (flags[i] === toU8(1)) {
        const at: i32 = base + i;
        if (start >= 0 && start < length && at >= 0 && at < length) {
          lines.push(text.substring(start, at));
          start = at + 1;
        }
      }
      i += 1;
    }
    if (n <= 0) {
      break;
    }
    base = end;
  }
  // Positions past the bound above, one at a time.
  while (base >= 0 && base < length) {
    if (toI32(text.charCodeAt(base)) === NEWLINE) {
      // Always holds, as above; it proves `start` within `text`.
      if (start >= 0 && start < length) {
        lines.push(text.substring(start, base));
      }
      start = base + 1;
    }
    base += 1;
  }
  if (start >= 0 && start < length) {
    lines.push(text.substring(start, length));
  }
  return lines;
};
