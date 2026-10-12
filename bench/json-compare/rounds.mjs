// The two rules of bench/json-compare/run.mjs that decide a result without
// timing anything, apart so that tests/run.js can hold them to their cases:
// the order a round runs its implementations in, and how two checksum lines
// are compared.

/**
 * The order round `round` runs `impls` in: rotated one further each round,
 * and reversed on every other block of `impls.length` rounds. Over any
 * 2 × n rounds every implementation runs in every position twice, and Nish
 * and its copy take turns going first, for any n; reversing every other
 * round instead would undo the rotation when n is 2.
 */
export const roundOrder = (impls, round) => {
  const n = impls.length
  const rotated = impls.map((_, k) => impls[(k + round) % n])
  return Math.floor(round / n) % 2 === 1 ? rotated.reverse() : rotated
}

/** A double as JavaScript writes it, with every language's spelling of the non-finite ones made one. */
const canonicalDouble = (t) => {
  if (/^[+]?inf(inity)?$/i.test(t)) {
    return "Infinity"
  }
  if (/^-inf(inity)?$/i.test(t)) {
    return "-Infinity"
  }
  if (/^[+-]?nan$/i.test(t)) {
    return "NaN"
  }
  return String(Number(t))
}

/**
 * A checksum line with its f64 sum, tokenize's fourth field, written as
 * JavaScript writes the double it spells: each language prints a
 * round-tripping double its own way, and a sum with no fraction can be all
 * digits (`%.17g`'s 26602007581164608 is 26602007581164610 elsewhere), so the
 * field is known by its place rather than by its look. C's `inf`, Go's
 * `+Inf` and Rust's `inf` are one value, and none of them is `nan`.
 */
export const canonical = (line) =>
  line
    .split(" ")
    .map((t, i) => (line.startsWith("tokenize ") && i === 3 ? canonicalDouble(t) : t))
    .join(" ")
