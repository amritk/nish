// `splitLines` in `nish/text` scans sixteen positions at a time with
// `nish:simd` over a 4096-position flag buffer and finishes the last
// fewer-than-sixteen one at a time. This program holds it to `scalarLines`,
// the one-position-at-a-time split it replaced, copied here, on every length
// either side of one and two blocks, on both sides of one and two chunks, on a
// newline at every position of a block and at each chunk edge, and on the
// endings the doc comment decides. `tests/run.js` runs it under Node too,
// against the same `expected.out`.
import { splitLines } from "nish/text";

const SCALAR_NEWLINE: i32 = 10;

/** `std/text`'s `splitLines` before it went lane-wise: one position at a time. */
const scalarLines = (text: string): string[] => {
  const length: i32 = toI32(text.length);
  const lines: string[] = [];
  let start: i32 = 0;
  let i: i32 = 0;
  while (i < length) {
    if (toI32(text.charCodeAt(i)) === SCALAR_NEWLINE) {
      if (start >= 0 && start < length) {
        lines.push(text.substring(start, i));
      }
      start = i + 1;
    }
    i += 1;
  }
  if (start < length) {
    lines.push(text.substring(start, length));
  }
  return lines;
};

/** Whether the two splits have the same lines in the same order. */
const sameLines = (a: string[], b: string[]): boolean => {
  if (a.length !== b.length) {
    return false;
  }
  for (let i: i32 = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
};

/** A text of `n` positions, a newline wherever `(p * step + seed) % 5` is 0 and a letter elsewhere. */
const pattern = (n: i32, step: i32, seed: i32): string => {
  const parts: string[] = [];
  for (let p: i32 = 0; p < n; p += 1) {
    parts.push((p * step + seed) % 5 === 0 ? "\n" : "x");
  }
  return parts.join("");
};

/** A text of `n` letters with one newline at `at`. */
const oneNewline = (n: i32, at: i32): string => {
  const parts: string[] = [];
  for (let p: i32 = 0; p < n; p += 1) {
    parts.push(p === at ? "\n" : "y");
  }
  return parts.join("");
};

export const main = (): number => {
  let mismatches: i32 = 0;
  // Each named text prints its line count from both, so the output pins the
  // answer as well as the agreement.
  const named: readonly string[] = [
    "",
    "\n",
    "a",
    "0123456789abcde",
    "0123456789abcdef",
    "0123456789abcdefg",
    "0123456789abcdef0123456789abcde",
    "0123456789abcdef0123456789abcdef0",
    "line one\nline two\nline three\nfour\n",
    "no trailing newline\nat the end of this one",
    "\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n",
    "crlf one\r\ncrlf two\r\ncrlf three\r\n",
    "héllo\nwörld\nĊĊĊĊĊĊĊĊĊĊĊĊĊĊĊĊĊĊ\nünïcödé\n",
    // A surrogate pair under Node, four bytes natively: neither half is a newline.
    "a😀\nb",
  ];
  for (let k: i32 = 0; k < named.length; k += 1) {
    const text = named[k];
    const lanes = splitLines(text);
    const scalar = scalarLines(text);
    if (!sameLines(lanes, scalar)) {
      mismatches += 1;
    }
    console.log(`text ${k}: ${lanes.length} lines, scalar ${scalar.length}`);
  }
  // `\r\n` keeps its `\r`, so a line ends in byte 13 either way.
  const crlf = splitLines("a\r\nb\r\n");
  console.log(`crlf keeps cr: ${crlf.length === 2 && crlf[0] === "a\r" && crlf[1] === "b\r"}`);
  // U+010A's low byte is 10: under Node a UTF-16 unit, natively two UTF-8
  // bytes, and in neither a newline.
  console.log(`U+010A is not a newline: ${splitLines("ĊĊ").length === 1}`);
  // Every length from 0 to 48, three newline patterns each: both block edges
  // and every tail length.
  let patterned: i32 = 0;
  for (let n: i32 = 0; n <= 48; n += 1) {
    for (let step: i32 = 1; step <= 3; step += 1) {
      const text = pattern(n, step, n);
      if (!sameLines(splitLines(text), scalarLines(text))) {
        mismatches += 1;
      }
      patterned += 1;
    }
  }
  console.log(`patterned texts: ${patterned}`);
  // One newline at each position of a 33-long text: first, last and every
  // lane of both blocks and the tail.
  let placed: i32 = 0;
  for (let at: i32 = 0; at < 33; at += 1) {
    const text = oneNewline(33, at);
    if (!sameLines(splitLines(text), scalarLines(text))) {
      mismatches += 1;
    }
    placed += 1;
  }
  console.log(`one newline placed: ${placed}`);
  // Either side of one and two 4096-position chunks, three patterns each, and
  // one newline at each position next to a chunk edge.
  const long: readonly i32[] = [4095, 4096, 4097, 8193];
  let chunked: i32 = 0;
  for (let k: i32 = 0; k < long.length; k += 1) {
    const n = long[k];
    for (let step: i32 = 1; step <= 3; step += 1) {
      const text = pattern(n, step, n);
      if (!sameLines(splitLines(text), scalarLines(text))) {
        mismatches += 1;
      }
      chunked += 1;
    }
    const edges: readonly i32[] = [0, 4079, 4094, 4095, 4096, 4097, 8191, 8192];
    for (let e: i32 = 0; e < edges.length; e += 1) {
      if (edges[e] < n) {
        const text = oneNewline(n, edges[e]);
        if (!sameLines(splitLines(text), scalarLines(text))) {
          mismatches += 1;
        }
        chunked += 1;
      }
    }
    console.log(`${n} positions: ${splitLines(pattern(n, 1, n)).length} lines`);
  }
  console.log(`chunk-edge texts: ${chunked}`);
  console.log(`mismatches: ${mismatches}`);
  return mismatches === 0 ? 0 : 1;
};
