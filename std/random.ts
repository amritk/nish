/**
 * `std/random` — a seeded generator of pseudo-random numbers whose every
 * answer is the same natively and under Node.
 *
 *     import { Rng } from "nish/random";
 *
 *     export const main = (): i32 => {
 *       const r = new Rng(42);
 *       const die: i32 = r.nextInt(1, 6); // 1 to 6, each with equal chance
 *       const u: f64 = r.nextF64(); // in [0, 1)
 *       return die;
 *     };
 *
 * **The state is one 32-bit integer.** Each step adds the odd constant
 * 0x9E3779B9 (2^32 divided by the golden ratio) to it, wrapping, so the
 * states walk all 2^32 values before any repeats, whatever the seed — 0
 * included. Each answer is MurmurHash3's 32-bit finaliser applied to the new
 * state (Austin Appleby's `fmix32`; MurmurHash3 is public domain, and these
 * are its constants): two multiplies and three shifted exclusive ors that mix
 * every bit of the state into every bit of the answer, so seeds 1, 2 and 3
 * answer three unrelated sequences. That pairing of a Weyl sequence with a
 * mixing function is the shape of SplitMix (Steele, Lea and Flood, "Fast
 * splittable pseudorandom number generators", OOPSLA 2014), on 32 bits.
 *
 * **The same bits under Node.** A wrapping multiply is `Math.imul`, the low
 * 32 bits of the product both ways. Every other sum, difference and remainder
 * is taken in `f64` on the state read as an unsigned count below 2^32, where
 * each answer is an integer below 2^33 and so exact, and comes back to an
 * `i32` only once a compare has put it in range. Every shift has a constant
 * count, and `^` and `>>> 16` answer the same 32 bits in JavaScript as in the
 * compiled program. `nextF64` builds its double from integers below 2^53, so
 * its products and sums are exact both ways. The program a test prints under
 * Node is the one it prints compiled (docs/RUN_UNDER_NODE.md).
 *
 * **It is not for cryptography**: a key or a nonce comes from
 * `crypto.getRandomValues`.
 *
 * **An `Rng` is an ordinary object**, so a parallel body or a task that makes one
 * of its own may step it as it likes: what a function allocates is its own
 * memory (docs/LANGUAGE.md, "Data parallelism"). One shared by several tasks
 * would be a write their caller can see, and is refused as any such write is;
 * give each task its own, seeded from its index.
 */

/** 0x9E3779B9, the Weyl increment: odd, so the walk visits every state. */
const GOLDEN: f64 = 2654435769.0

/** 0x85EBCA6B as an `i32`: MurmurHash3's first finaliser multiplier (public domain). */
const MIX_1: i32 = -2048144789

/** 0xC2B2AE35 as an `i32`: MurmurHash3's second finaliser multiplier (public domain). */
const MIX_2: i32 = -1028477387

/** 2^26, the weight of the high draw in `nextF64`'s 53 bits. */
const TWO_26: f64 = 67108864.0

/** 2^31: an unsigned count at least this is a negative `i32`. */
const TWO_31: f64 = 2147483648.0

/** 2^32, the number of states. */
const TWO_32: f64 = 4294967296.0

/** 2^53, which scales a 53-bit integer into [0, 1). */
const TWO_53: f64 = 9007199254740992.0

/** The bits of `x` read as an unsigned count, from 0 to 2^32 - 1. */
const unsigned = (x: i32): f64 => (x < 0 ? toF64(x) + TWO_32 : toF64(x))

/**
 * The `i32` whose bits read as the unsigned count `u`, which is an integer
 * from 0 to 2^32 - 1: below 2^31 it is `u`, and from there `u - 2^32`, so
 * each `toI32` converts a value inside the `i32` range.
 */
const bits = (u: f64): i32 => (u < TWO_31 ? toI32(u) : toI32(u - TWO_32))

/** MurmurHash3's `fmix32`: every bit of `h` into every bit of the answer, a bijection on 32 bits. */
const mix = (h: i32): i32 => {
  let x: i32 = h
  x = x ^ (x >>> 16)
  x = Math.imul(x, MIX_1)
  x = x ^ (x >>> 13)
  x = Math.imul(x, MIX_2)
  x = x ^ (x >>> 16)
  return x
}

/** A generator of pseudo-random numbers: a Weyl sequence from its seed, each state mixed. */
export class Rng {
  /** Where the walk is: the seed plus the increment times the steps taken, wrapped. */
  private state: i32

  /**
   * A generator whose sequence `seed` decides: two made from one seed answer
   * the same numbers.
   *
   * @param seed any `i32`, 0 and negatives included. The walk is one cycle
   *   of 2^32 states, so seeds are starting points on it, not separate
   *   sequences: `seed + k * 0x9E3779B9`, wrapped, answers the same numbers as
   *   `seed`, `k` steps later.
   */
  constructor(seed: i32) {
    this.state = seed
  }

  /**
   * The next 32 bits, as an `i32`: over 2^32 steps each value is answered
   * exactly once.
   *
   * @returns any `i32`, negatives included, each equally likely; the generator
   *   steps once.
   */
  nextI32(): i32 {
    const next: f64 = unsigned(this.state) + GOLDEN
    this.state = bits(next < TWO_32 ? next : next - TWO_32)
    return mix(this.state)
  }

  /**
   * The next number in [0, 1), from two steps: the high 27 bits of one and
   * the high 26 of the next make a 53-bit integer, which a double holds
   * exactly, scaled by 2^-53.
   *
   * @returns a multiple of 2^-53 at least 0 and below 1; the generator steps
   *   twice.
   */
  nextF64(): f64 {
    const hi: i32 = this.nextI32() >>> 5
    const lo: i32 = this.nextI32() >>> 6
    return (toF64(hi) * TWO_26 + toF64(lo)) / TWO_53
  }

  /**
   * An integer in [lo, hi], both ends included, each with equal chance;
   * `nextInt(1, 6)` is a die. It panics when `lo` is greater than `hi`, and
   * the whole `i32` range, `nextInt(-2147483648, 2147483647)`, is one
   * `nextI32()`.
   *
   * There is no modulo bias: where the span `hi - lo + 1`, an unsigned count
   * up to 2^32, does not divide 2^32 evenly, a draw among the lowest
   * 2^32 mod span is refused and drawn again, and what is left holds every
   * answer equally often. Fewer than half the draws are ever refused, so an
   * answer takes one `nextI32()` step usually and fewer than two on average,
   * and a sequence is still the seed's.
   *
   * @param lo the smallest answer allowed.
   * @param hi the largest answer allowed; equal to `lo` answers `lo`, and below
   *   it stops the program.
   * @returns an integer from `lo` to `hi` inclusive.
   */
  nextInt(lo: i32, hi: i32): i32 {
    if (lo > hi) {
      panic("Rng.nextInt: lo is greater than hi")
    }
    // From 1 to 2^32, and lo plus any remainder of it is at most hi.
    const span: f64 = toF64(hi) - toF64(lo) + 1.0
    if (span === TWO_32) {
      return this.nextI32()
    }
    const refused: f64 = TWO_32 % span
    let draw: f64 = unsigned(this.nextI32())
    while (draw < refused) {
      draw = unsigned(this.nextI32())
    }
    return toI32(toF64(lo) + (draw % span))
  }
}
