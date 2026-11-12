// The paired-rounds proof's decision (README.md, "portableRounds"), apart from
// the timing so that tests/run.js can put numbers to it: run.mjs times the
// rounds and asks this module whether they prove the portable column.

/** How many interleaved rounds one paired set times. */
export const PAIRED_ROUNDS = 48

/**
 * The chance the proof may give a mask that changed nothing a pass, over every
 * set it may time: two per case (a set and its retry), and a family with a
 * list of cases tries each in turn, so each set gets an even share.
 */
const PAIRED_ALPHA = 0.001

/**
 * The least ratio of the portable column's fastest paired round to its twin's
 * that a pass needs, besides the count. A mask that changed nothing measures
 * about 1.000x (0.998x to 1.002x on GitHub's runners), and there the count is
 * all chance, so a tie must not decide; the curves family's real mask
 * measures 1.029x to 1.046x on the same runners, three times this margin.
 */
export const PAIRED_MIN_RATIO = 1.01

/**
 * The fewest of `n` paired rounds the portable column must lose for a mask
 * that changed nothing to reach it with probability at most `alpha`: with the
 * same code on both sides each round is a coin toss, whatever the noise.
 * @param {number} n the rounds in a set
 * @param {number} alpha the chance allowed
 * @returns {number} the count a set must reach
 */
const roundsNeeded = (n, alpha) => {
  let choose = 1
  let tail = 0
  for (let k = n; k >= 0; k--) {
    tail += choose / 2 ** n
    if (tail > alpha) {
      return k + 1
    }
    choose = (choose * k) / (n - k + 1)
  }
  return 0
}

/**
 * The count a set of `PAIRED_ROUNDS` must reach when the proof has `cases`
 * cases to try: `PAIRED_ALPHA` split over the two sets each may time.
 * @param {number} cases how many proof cases the twin may try
 * @returns {number} the count a set must reach
 */
export const pairedWant = (cases) => roundsNeeded(PAIRED_ROUNDS, PAIRED_ALPHA / (2 * cases))

/**
 * Whether one set proves the portable column: it lost at least `want` of the
 * rounds, and its fastest round took at least `PAIRED_MIN_RATIO` times its
 * twin's.
 * @param {number} lost the rounds the portable column was the slower in
 * @param {number} want the count from `pairedWant`
 * @param {number} ratio the portable column's fastest round over its twin's
 * @returns {boolean} whether the set proves the column
 */
export const pairedProves = (lost, want, ratio) => lost >= want && ratio >= PAIRED_MIN_RATIO
