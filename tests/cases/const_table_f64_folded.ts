// An `f64` constant table whose elements are folded from other constants and
// arithmetic over them, not literals alone: the data global holds the folded
// doubles, and each prints as the expression it was written as would.
const HALF: f64 = 0.5
const SCALE: f64 = HALF * 4
const TINY: f64 = 1e-300
const STEP: i32 = 3

const WEIGHTS: readonly f64[] = [HALF, SCALE / 3, -SCALE, HALF + SCALE * SCALE, TINY * TINY, 1 / 3 + HALF, -0.0]

export const main = (): void => {
  const parts: string[] = []
  for (const w of WEIGHTS) {
    parts.push(`${w}`)
  }
  console.log(`${WEIGHTS.length}: ${parts.join(" ")}`)
  console.log(`${WEIGHTS[STEP] - WEIGHTS[0]} ${1 / WEIGHTS[6]}`)
}
