// What hoisting an array header out of a loop is worth (WP15 §2c candidate 2),
// measured by a program that ships rather than quoted from a note nobody else
// can re-run.
//
// Three scans do the same arithmetic over the same 8192 doubles -- the same
// element loop, the same two bounds checks, the same store -- and differ only
// in where the source array is *kept*:
//
//   paramScan    takes it as a parameter, so the loop reads `src.length`.
//   fieldScan    reads it out of a class field, so the loop reads
//                `h.xs.length`. This is the shape `self/` is written in:
//                `knownAtMost` in `self/bounds.ts` is it verbatim, a `while`
//                over `state.atMostIndex.length` reading `state.atMostIndex[k]`
//                and `state.atMostHolder[k]`, and §2c counted 24 functions in
//                that one module carrying a header load inside a loop.
//   hoistedScan  reads the same field once into a `const` before the loop --
//                the hoist a programmer can write by hand, and the one the
//                emitter is meant to do for them.
//
// The third scan is what makes this an acceptance test rather than a stopwatch:
// where `hoisted` lands on `param` is the number the emitter has to reach, and
// it is measured on whatever box is running this, so the reader does not have to
// take §2c's on trust for it.
//
// The mechanism, as this program's own `--profile speed` build shows it under
// `opt -O3`: `paramScan`'s two lengths become one trip count -- an
// `llvm.umin.i64` of `src.length` and `dst.length`, computed in the preheader
// -- so the loop has one exit and vectorises. `fieldScan` gets no `umin`: it
// compares against `h.xs.length` and `dst.length` separately, the second exit
// stops the vectoriser, and `h.xs`'s `data` is reloaded every iteration in the
// bounds-checked block, where it cannot be speculated out. Collapsing the two
// uses onto one `const` is what fixes both at once, which is why the inlined
// `hoistedScan` loop carries a `vector.body` and the inlined `fieldScan` loop
// does not.
//
// Which is why the criterion is **not** "no header load left in the loop": §2c
// reached that state by hand, with metadata, and measured the program 5 ms
// *slower*. It is **one length value feeding the loop condition and the bounds
// check both**, and what to look for in the `opt -O2` dump is the `umin`, or
// one compare where there were two.
//
// This program measures that criterion; it does not assert it. Whoever lands
// candidate 2 should pin the structural half as well, and `tests/run.js` already
// has the shape to copy -- the `arr_alias_domains` block walks `opt -O2`'s dump
// of one function and asserts on what is left in the loop. No golden anywhere
// pins a `umin` today.
//
// The four `NL9007` warnings this file compiles with are expected and must not
// be guarded away: adding `if (i >= 0 && i < dst.length)` would put a third
// compare in the loop and measure a different program. §2b measured the checks
// themselves at 0.5% of this loop, so they are not what the ratio is.
//
// The scans are exported so their symbols survive for anyone reading the
// disassembly; LLVM inlines them into the pass loops regardless, which is how
// §2c measured the same three shapes.
//
// Timed in alternating rounds and reported as the minimum of REPS, so a machine
// drifting under the run lands on all three.

class Holder {
  xs: f64[];
  constructor(xs: f64[]) {
    this.xs = xs;
  }
}

export const paramScan = (dst: f64[], src: f64[]): void => {
  let i: i32 = 0;
  while (i < src.length) {
    dst[i] = src[i] * 2.0;
    i = i + 1;
  }
};

export const fieldScan = (dst: f64[], h: Holder): void => {
  let i: i32 = 0;
  while (i < h.xs.length) {
    dst[i] = h.xs[i] * 2.0;
    i = i + 1;
  }
};

export const hoistedScan = (dst: f64[], h: Holder): void => {
  const xs = h.xs;
  let i: i32 = 0;
  while (i < xs.length) {
    dst[i] = xs[i] * 2.0;
    i = i + 1;
  }
};

// The three pass loops are one loop written three times, and each keeps its
// scan alive the way §2c's `main` does: it reads `dst[0]` back into an
// accumulator so the stores are not dead, and moves `src[0]` so that PASSES
// passes are not one pass folded PASSES times. The two field loops are handed
// `src` for that bump rather than writing `h.xs[0]`, so that the only read of
// the field anywhere in the three is the one being measured.
const paramPasses = (dst: f64[], src: f64[], passes: i32): f64 => {
  let acc: f64 = 0.0;
  let pass: i32 = 0;
  while (pass < passes) {
    paramScan(dst, src);
    acc = acc + dst[0];
    src[0] = src[0] + 1.0;
    pass = pass + 1;
  }
  return acc;
};

const fieldPasses = (dst: f64[], src: f64[], h: Holder, passes: i32): f64 => {
  let acc: f64 = 0.0;
  let pass: i32 = 0;
  while (pass < passes) {
    fieldScan(dst, h);
    acc = acc + dst[0];
    src[0] = src[0] + 1.0;
    pass = pass + 1;
  }
  return acc;
};

const hoistedPasses = (dst: f64[], src: f64[], h: Holder, passes: i32): f64 => {
  let acc: f64 = 0.0;
  let pass: i32 = 0;
  while (pass < passes) {
    hoistedScan(dst, h);
    acc = acc + dst[0];
    src[0] = src[0] + 1.0;
    pass = pass + 1;
  }
  return acc;
};

export const main = (): number => {
  const N: i32 = 8192; // L2-resident, the size §2b and §2c both measured
  const PASSES: i32 = 150000;
  const REPS: i32 = 7;

  const src: f64[] = new Array<f64>(N);
  const dst: f64[] = new Array<f64>(N);
  let i: i32 = 0;
  while (i < N) {
    src[i] = toF64(i);
    i = i + 1;
  }
  // One array, reached two ways: as `src` by the parameter shape, and as `h.xs`
  // by the two field shapes. Nothing but the spelling of the loop differs.
  const h = new Holder(src);

  let paramUs: i64 = 0;
  let fieldUs: i64 = 0;
  let hoistedUs: i64 = 0;
  let checksum: f64 = 0.0;
  let rep: i32 = 0;
  while (rep < REPS) {
    const a = monotonicNanos();
    checksum = checksum + paramPasses(dst, src, PASSES);
    const b = monotonicNanos();
    checksum = checksum + fieldPasses(dst, src, h, PASSES);
    const c = monotonicNanos();
    checksum = checksum + hoistedPasses(dst, src, h, PASSES);
    const d = monotonicNanos();
    const param = (b - a) / 1000;
    const field = (c - b) / 1000;
    const hoisted = (d - c) / 1000;
    if (rep === 0 || param < paramUs) {
      paramUs = param;
    }
    if (rep === 0 || field < fieldUs) {
      fieldUs = field;
    }
    if (rep === 0 || hoisted < hoistedUs) {
      hoistedUs = hoisted;
    }
    rep = rep + 1;
  }

  // `toI64` on each side rather than on the product: the multiply happens in
  // whatever type its operands have, so `toI64(N * PASSES)` would still wrap.
  console.log(`elements ${toI64(N) * toI64(PASSES)} per scan, per round`);
  console.log(`param    ${paramUs} us`);
  console.log(`field    ${fieldUs} us`);
  console.log(`hoisted  ${hoistedUs} us`);
  console.log(`field/param   ${toF64(fieldUs) / toF64(paramUs)}`);
  console.log(`field/hoisted ${toF64(fieldUs) / toF64(hoistedUs)}`);
  console.log(`checksum ${checksum}`);
  return 0;
};
