// A seeded mutation fuzz over the corpus: each mutant is one file with a byte
// flipped, inserted or deleted, or cut short, and it is tokenized three ways —
// alone, again by a reset tokenizer, and as a window of a larger array padded
// with bytes that would change the verdict if a read strayed past the window.
// The run has to end (no panic), every tokenization has to stop within one
// call per byte, and the three verdicts have to agree. The seed is fixed, so
// the run is the same on every machine and its totals are pinned.
import { JSON_TOK_END, JsonLimits, JsonTokenizer } from "../../../std/json-tokenizer";
import { Suite } from "../../../std/testing";
import { jtRun } from "./common";
import { JtCase, jtLoadCorpus } from "./corpus";

/** How many mutants, and from what seed. */
const JT_FUZZ_COUNT: i32 = 20000;
const JT_FUZZ_SEED: i32 = 1592653589;
/** Files longer than this are left out of the pool: the two depth bombs, which would make each mutant 100 KB. */
const JT_FUZZ_MAX_BYTES: i32 = 4096;
/** The bytes padded around a window: each would extend, close or continue a value if it were read. */
const JT_FUZZ_PAD: i32 = 8;

/** xorshift32 (Marsaglia, 2003), public domain: the next state. */
const jtXorshift = (x: i32): i32 => {
  let s: i32 = x;
  s = s ^ (s << 13);
  s = s ^ (s >>> 17);
  s = s ^ (s << 5);
  return s;
};

/** A value in `[0, n)` from a state. */
const jtBelow = (state: i32, n: i32): i32 => {
  const r: i32 = (state >>> 1) % n;
  return r < 0 ? 0 : r;
};

/** `bytes` with one mutation applied, chosen by `a`, `b` and `c`. */
const jtMutate = (bytes: u8[], a: i32, b: i32, c: i32): u8[] => {
  const n: i32 = toI32(bytes.length);
  const out: u8[] = [];
  const kind: i32 = jtBelow(a, 4);
  const at: i32 = n === 0 ? 0 : jtBelow(b, n + 1);
  let i: i32 = 0;
  while (i < n && i < toI32(bytes.length)) {
    const byte: i32 = toI32(bytes[i]);
    if (i === at && kind === 0) {
      // Flip one bit.
      out.push(toU8(byte ^ (1 << jtBelow(c, 8))));
    } else if (i === at && kind === 1) {
      // Insert a byte before this one.
      out.push(toU8(jtBelow(c, 256)));
      out.push(toU8(byte));
    } else if (i === at && kind === 2) {
      // Delete this byte.
    } else if (i >= at && kind === 3) {
      // Cut short here.
      break;
    } else {
      out.push(toU8(byte));
    }
    i += 1;
  }
  if (at === n && kind === 1) {
    out.push(toU8(jtBelow(c, 256)));
  }
  return out;
};

/** The verdict of a run, folded with where it stopped, as one number. */
const jtOutcome = (t: JsonTokenizer, k: i32, base: i32): i64 =>
  k === JSON_TOK_END ? toI64(0) : toI64(k) * toI64(1000003) + toI64(t.errorAt - base);

export const jtFuzz = (t: Suite): void => {
  const pool: JtCase[] = [];
  for (const c of jtLoadCorpus()) {
    if (toI32(c.bytes.length) <= JT_FUZZ_MAX_BYTES) {
      pool.push(c);
    }
  }
  if (!t.eqI32("fuzz: the pool is every corpus file of at most 4 KiB", toI32(pool.length), 316)) {
    return;
  }
  const padding: u8[] = [34, 91, 49, 92, 123, 93, 125, 44];
  const limits = new JsonLimits();
  const reused = new JsonTokenizer([], 0, 0, limits);
  let state: i32 = JT_FUZZ_SEED;
  let accepted: i32 = 0;
  let stuck: i32 = 0;
  let disagreed: i32 = 0;
  let firstDisagreement = "";
  let checksum: i64 = 0;
  let m: i32 = 0;
  while (m < JT_FUZZ_COUNT) {
    state = jtXorshift(state);
    const pick: i32 = jtBelow(state, toI32(pool.length));
    state = jtXorshift(state);
    const a: i32 = state;
    state = jtXorshift(state);
    const b: i32 = state;
    state = jtXorshift(state);
    const c: i32 = state;
    if (pick < 0 || pick >= toI32(pool.length)) {
      break;
    }
    const base = pool[pick];
    const mutant = jtMutate(base.bytes, a, b, c);
    const len: i32 = toI32(mutant.length);

    const alone = new JsonTokenizer(mutant, 0, len, limits);
    const k1: i32 = jtRun(alone, len);
    const o1: i64 = jtOutcome(alone, k1, 0);

    reused.reset(mutant, 0, len);
    const k2: i32 = jtRun(reused, len);
    const o2: i64 = jtOutcome(reused, k2, 0);

    const padded: u8[] = [];
    let p: i32 = 0;
    while (p < JT_FUZZ_PAD && p < toI32(padding.length)) {
      padded.push(padding[p]);
      p += 1;
    }
    for (const byte of mutant) {
      padded.push(byte);
    }
    p = 0;
    while (p < JT_FUZZ_PAD && p < toI32(padding.length)) {
      padded.push(padding[toI32(padding.length) - 1 - p]);
      p += 1;
    }
    const inside = new JsonTokenizer(padded, JT_FUZZ_PAD, len, limits);
    const k3: i32 = jtRun(inside, len);
    const o3: i64 = jtOutcome(inside, k3, JT_FUZZ_PAD);

    if (k1 > 0 || k2 > 0 || k3 > 0) {
      stuck += 1;
    }
    if (o1 !== o2 || o1 !== o3) {
      disagreed += 1;
      if (firstDisagreement.length === 0) {
        firstDisagreement = `mutant ${m} of ${base.name}: ${o1}, ${o2}, ${o3}`;
      }
    }
    if (k1 === JSON_TOK_END) {
      accepted += 1;
    }
    checksum = (checksum * toI64(31) + o1) % toI64(1000000007);
    m += 1;
  }
  t.eqI32("fuzz: 20,000 mutants were tokenized, none panicked", m, JT_FUZZ_COUNT);
  t.eqI32("fuzz: every run stopped within one call per byte", stuck, 0);
  if (disagreed === 0) {
    t.pass("fuzz: alone, after a reset and inside a padded window, every mutant has one verdict");
  } else {
    t.fail("fuzz: alone, after a reset and inside a padded window, every mutant has one verdict", firstDisagreement);
  }
  t.eqI32("fuzz: the seed's mutants, accepted", accepted, 1874);
  t.eqI64("fuzz: the checksum of every verdict and where it stopped", checksum, toI64(-449425089));
};
