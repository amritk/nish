/**
 * `std/random` — a seeded generator of pseudo-random numbers whose every
 * answer is the same natively and under Node.
 *
 *     import { Rng } from "nish/random";
 *
 *     const r = new Rng(42);
 *     const die: i32 = 1 + (r.nextI32() >>> 1) % 6;
 *     const u: f64 = r.nextF64(); // in [0, 1)
 *
 * The state is one 32-bit integer stepped by Marsaglia's xorshift32
 * (G. Marsaglia, "Xorshift RNGs", Journal of Statistical Software 8(14),
 * 2003; the triple 13, 17, 5). It is an idea from a paper, not a copy of
 * anyone's code. The step is three shifts and three exclusive ors on an `i32`,
 * and each of those answers the same 32 bits in JavaScript as in the compiled
 * program: `<<` and `^` answer a signed 32-bit integer there too, and
 * `>>> 17` answers at most 2^15 - 1, which reads back the same signed or not.
 * Nothing adds or multiplies the state, so nothing overflows, natively or
 * under Node. That is the whole reason for the choice over a generator with a
 * multiply in its step: the program a test prints under Node is the one it
 * prints compiled (docs/RUN_UNDER_NODE.md).
 *
 * The sequence has period 2^32 - 1 and visits every nonzero state; it is fast
 * and small, and its low bits are weaker than its high ones, so a bounded draw
 * should shift before it takes a remainder, as the example above does. It is
 * not for cryptography: a key or a nonce comes from `crypto.getRandomValues`.
 *
 * An `Rng` is an ordinary object, so a parallel body or a task that makes one
 * of its own may step it as it likes: what a function allocates is its own
 * memory (docs/LANGUAGE.md, "Data parallelism"). One shared by several tasks
 * would be a write their caller can see, and is refused as any such write is;
 * give each task its own, seeded from its index.
 */

/**
 * The state a seed of 0 starts from, since xorshift32 never leaves 0: an
 * arbitrary odd constant below 2^31, so that it is an `i32` literal.
 */
const ZERO_SEED: i32 = 1831565813

/** 2^26, the weight of the high draw in `nextF64`'s 53 bits. */
const TWO_26: f64 = 67108864.0

/** 2^53, which scales a 53-bit integer into [0, 1). */
const TWO_53: f64 = 9007199254740992.0

/** A generator of pseudo-random numbers, stepped by xorshift32 from its seed. */
export class Rng {
  /** The last value stepped to; never 0. */
  state: i32

  /** A generator whose sequence `seed` decides: two made from one seed answer the same numbers. */
  constructor(seed: i32) {
    this.state = seed === 0 ? ZERO_SEED : seed
  }

  /** The next 32 bits, as an `i32`: any value but 0, each as likely as the others over a whole period. */
  nextI32(): i32 {
    let x: i32 = this.state
    x = x ^ (x << 13)
    x = x ^ (x >>> 17)
    x = x ^ (x << 5)
    this.state = x
    return x
  }

  /**
   * The next number in [0, 1), from two steps: the high 27 bits of one and
   * the high 26 of the next make a 53-bit integer, which a double holds
   * exactly, scaled by 2^-53. Every product and sum is exact, so the answer
   * is the same bits natively and under Node.
   */
  nextF64(): f64 {
    const hi: i32 = this.nextI32() >>> 5
    const lo: i32 = this.nextI32() >>> 6
    return (toF64(hi) * TWO_26 + toF64(lo)) / TWO_53
  }
}
