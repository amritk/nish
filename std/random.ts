/**
 * `std/random` — a seeded generator of pseudo-random numbers whose every
 * answer is the same natively and under Node.
 *
 *     import { Rng } from "nish/random";
 *
 *     const r = new Rng(42);
 *     const die: i32 = r.nextInt(1, 6); // 1 to 6, each with equal chance
 *     const u: f64 = r.nextF64(); // in [0, 1)
 *
 * The state is one 32-bit integer. Each step adds the odd constant
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
 * **The same bits under Node.** The two operations that wrap are spelled
 * `wrappingAdd` and `wrappingMul` from `nish:unsafe`, which define the
 * two's-complement wrap natively and answer `(a + b) | 0` and `Math.imul(a, b)`
 * under Node (docs/LANGUAGE.md, "nish:unsafe"); every shift has a constant
 * count, and `^` and `>>> 16` answer the same 32 bits in JavaScript as in the
 * compiled program. `nextInt` reads its span and its draws as unsigned
 * counts with no `u32` (whose conversions saturate under Node): the sign bit
 * flipped orders them under a signed compare, and the remainder is taken in
 * pieces that stay below 2^31. `nextF64` builds its double from integers
 * below 2^53, so its products and sums are exact both ways. The program a test prints under
 * Node is the one it prints compiled (docs/RUN_UNDER_NODE.md).
 *
 * It is not for cryptography: a key or a nonce comes from
 * `crypto.getRandomValues`.
 *
 * An `Rng` is an ordinary object, so a parallel body or a task that makes one
 * of its own may step it as it likes: what a function allocates is its own
 * memory (docs/LANGUAGE.md, "Data parallelism"). One shared by several tasks
 * would be a write their caller can see, and is refused as any such write is;
 * give each task its own, seeded from its index.
 */
import { wrappingAdd, wrappingMul, wrappingSub } from "nish:unsafe"

/** 0x9E3779B9 as an `i32`: the Weyl increment, odd, so the walk visits every state. */
const GOLDEN: i32 = -1640531527

/** 0x85EBCA6B as an `i32`: MurmurHash3's first finaliser multiplier (public domain). */
const MIX_1: i32 = -2048144789

/** 0xC2B2AE35 as an `i32`: MurmurHash3's second finaliser multiplier (public domain). */
const MIX_2: i32 = -1028477387

/** 2^26, the weight of the high draw in `nextF64`'s 53 bits. */
const TWO_26: f64 = 67108864.0

/** 2^53, which scales a 53-bit integer into [0, 1). */
const TWO_53: f64 = 9007199254740992.0

/** The sign bit: `x ^ SIGN` orders the bits of `x` as an unsigned count under a signed compare. */
const SIGN: i32 = -2147483648

/** 2^31 - 1, the `i32` just below 2^31, from which `remainder` finds 2^31 mod m. */
const MAX: i32 = 2147483647

/** Whether `a < b` when both are read as unsigned 32-bit counts. */
const below = (a: i32, b: i32): boolean => (a ^ SIGN) < (b ^ SIGN)

/**
 * `a mod m` with both read as unsigned 32-bit counts and `m` not 0. A count
 * of 2^31 or more is a negative `i32`, so it is taken apart into pieces a
 * signed `%` answers the same in JavaScript, and every sum stays below 2^31.
 */
const remainder = (a: i32, m: i32): i32 => {
  if (m < 0) {
    // m is 2^31 or more, so a is less than 2m: at most one m comes off.
    return below(a, m) ? a : wrappingSub(a, m)
  }
  if (a >= 0) {
    return a % m
  }
  // a is 2^31 + low, so a mod m is low plus 2^31 mod m, added mod m.
  const low: i32 = (a ^ SIGN) % m
  const high: i32 = wrappingAdd(MAX % m, 1) % m
  const room: i32 = wrappingSub(m, high)
  return low >= room ? wrappingSub(low, room) : wrappingAdd(low, high)
}

/** MurmurHash3's `fmix32`: every bit of `h` into every bit of the answer, a bijection on 32 bits. */
const mix = (h: i32): i32 => {
  let x: i32 = h
  x = x ^ (x >>> 16)
  x = wrappingMul(x, MIX_1)
  x = x ^ (x >>> 13)
  x = wrappingMul(x, MIX_2)
  x = x ^ (x >>> 16)
  return x
}

/** A generator of pseudo-random numbers: a Weyl sequence from its seed, each state mixed. */
export class Rng {
  /** Where the walk is: the seed plus the increment times the steps taken, wrapped. */
  state: i32

  /** A generator whose sequence `seed` decides: two made from one seed answer the same numbers. */
  constructor(seed: i32) {
    this.state = seed
  }

  /** The next 32 bits, as an `i32`: over 2^32 steps each value is answered exactly once. */
  nextI32(): i32 {
    this.state = wrappingAdd(this.state, GOLDEN)
    return mix(this.state)
  }

  /**
   * The next number in [0, 1), from two steps: the high 27 bits of one and
   * the high 26 of the next make a 53-bit integer, which a double holds
   * exactly, scaled by 2^-53.
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
   */
  nextInt(lo: i32, hi: i32): i32 {
    if (lo > hi) {
      panic("Rng.nextInt: lo is greater than hi")
    }
    const span: i32 = wrappingAdd(wrappingSub(hi, lo), 1)
    if (span === 0) {
      return this.nextI32()
    }
    // 2^32 mod span, as (2^32 - span) mod span.
    const refused: i32 = remainder(wrappingSub(0, span), span)
    let draw: i32 = this.nextI32()
    while (below(draw, refused)) {
      draw = this.nextI32()
    }
    return wrappingAdd(lo, remainder(draw, span))
  }
}
