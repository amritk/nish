// What proving a `substring` bound is worth (WP15 §8 `NL9009`), measured by a
// program that ships rather than asserted from a run nobody can repeat.
//
// Two scans slice the same 40 KB string into the same 16-byte pieces, with the
// same control flow and the same guard. They differ in one thing: `clampedScan`
// spells each bound `at + 0`, which the §2 analysis cannot place in
// `[0, s.length]` (it proves a bare local and a decimal literal, nothing else),
// so both ends keep the clamp JavaScript specifies -- an `llvm.smin` and an
// `llvm.smax` apiece. `provenScan` spells the same values as the locals the
// guard proved, so the emitter writes them straight through: six intrinsic
// calls against two, which is what `node tests/run.js performance` asserts on
// `tests/cases/perf_clamp_quiet`.
//
// The gap the measurement sees is wider than the four calls the emitter left
// out, and every bit of it is still this change. Exported so that neither scan
// is inlined away, and run through `opt -O3`, the two bodies come out at six
// calls against *zero*: dropping the clamps is what lets LLVM prove
// `at <= at + 16` and fold the swap pair as well, which it cannot do while
// each end has been through an `smin`/`smax`. So the ratio below is six
// intrinsic calls a slice, not four, and nothing else differs between them --
// the `+ 0` is gone by then, and the guard is in both.
//
// The guard is in both, including the scan that cannot use it, so that its
// four compares cancel instead of being charged to the fold.
//
// This is the ceiling, not the expectation: the loop does nothing but slice,
// and a slice is one arena allocation and a `memcpy`, so the four intrinsics
// are a bigger share of the body here than they can be in a program that then
// looks at the bytes. §4 measures 1.18x for `slice` over `substring` -- the
// same instructions plus the two swap calls -- on a lexer-shaped scan.
//
// Timed in alternating rounds, reported as the minimum of REPS, so a machine
// drifting under the run lands on both.

function text(bytes: number): string {
  const parts: string[] = [];
  let n = 0;
  while (n < bytes) {
    parts.push("the quick brown fox jumps over the lazy dog 0123456789 ");
    n = n + 55;
  }
  // A whole number of 16-byte slices, so the guard never fails and the two
  // scans return the same checksum.
  return parts.join("").substring(0, bytes);
}

function clampedScan(s: string, rounds: number): number {
  let total = 0;
  for (let r = 0; r < rounds; r++) {
    let at = 0;
    while (at < s.length) {
      const end = at + 16;
      if (at >= 0 && at <= s.length && end >= 0 && end <= s.length) {
        total = total + s.substring(at + 0, end + 0).length;
      }
      at = end;
    }
  }
  return total;
}

function provenScan(s: string, rounds: number): number {
  let total = 0;
  for (let r = 0; r < rounds; r++) {
    let at = 0;
    while (at < s.length) {
      const end = at + 16;
      if (at >= 0 && at <= s.length && end >= 0 && end <= s.length) {
        total = total + s.substring(at, end).length;
      }
      at = end;
    }
  }
  return total;
}

export function main(): number {
  const BYTES = 40960; // 2,560 slices a round, and a multiple of 16
  const ROUNDS = 400;
  const REPS = 15;
  const s = text(BYTES);

  let clampedUs: i64 = 0;
  let provenUs: i64 = 0;
  let checksum = 0;
  for (let rep = 0; rep < REPS; rep++) {
    const a = monotonicNanos();
    checksum = clampedScan(s, ROUNDS);
    const b = monotonicNanos();
    checksum = checksum + provenScan(s, ROUNDS);
    const c = monotonicNanos();
    if (rep === 0 || (b - a) / 1000 < clampedUs) {
      clampedUs = (b - a) / 1000;
    }
    if (rep === 0 || (c - b) / 1000 < provenUs) {
      provenUs = (c - b) / 1000;
    }
  }
  const calls = (BYTES / 16) * ROUNDS;
  console.log(`checksum ${checksum}`);
  console.log(`calls    ${calls}`);
  console.log(`clamped  ${clampedUs} us`);
  console.log(`proven   ${provenUs} us`);
  return 0;
}
