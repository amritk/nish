/**
 * A class-A program that is mostly comments: block, line, JSDoc and trailing
 * ones, and one inside an expression. A writer that re-printed the tree would
 * lose them; `--emit-ts` edits the source text, so every one survives.
 */

// A row of `n` stars, one per step.
const stars = (n: number): string => {
  const row: string[] = [] // the stars so far
  for (let i = 0; i < n; i++) {
    /* the i-th star */
    row.push("*")
  }
  return row.join("")
}

/** Prints a line per `n`, then exits cleanly. */
export const main = (): number => {
  for (const n of [1, 2, 3, 10]) {
    console.log(`${n} -> ${stars(n /* how many */)}`)
  }
  return 0 // success
}
