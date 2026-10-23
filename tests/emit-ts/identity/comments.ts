/**
 * A class-A program that is mostly comments: block, line, JSDoc and trailing
 * ones, and one inside an expression. A writer that re-printed the tree would
 * lose them; `--emit-ts` edits the source text, so every one survives.
 */

// The sum of the first `n` odd numbers is `n * n`.
const oddSum = (n: number): number => {
  let sum = 0 // the running total
  for (let i = 0; i < n; i++) {
    /* the i-th odd number */
    sum = sum + (2 * i + 1)
  }
  return sum
}

/** Prints a line per `n`, then exits cleanly. */
export const main = (): number => {
  for (const n of [1, 2, 3, 10]) {
    console.log(`${n} -> ${oddSum(n /* how many */)}`)
  }
  return 0 // success
}
