// Constant tables of the other fixed-width numbers: each is one read-only
// data global with its folded values, read like any `readonly` array.
const LIMIT: i32 = 1000

const STEPS: readonly i32[] = [-LIMIT, -1, 0, 7, LIMIT * 2, 2147483647]
const BIG: readonly i64[] = [toI64(1) << toI64(40), -9, 0]
const WEIGHTS: readonly f64[] = [0.5, 1.25, -3.0, 1e100]
const WIDE: readonly u16[] = [0, 65535, 300]
const MASKS: readonly u32[] = [0, 255, 4294967295]

const total = (xs: readonly i32[]): i32 => {
  let s = 0
  for (const x of xs) {
    s += x % 1000
  }
  return s
}

export const main = (): void => {
  console.log(`${STEPS.length} ${STEPS[0]} ${STEPS[5]} ${total(STEPS)}`)
  console.log(`${BIG[0]} ${BIG[1] * toI64(2)} ${BIG.length}`)
  let w = 0.0
  for (let i = 0; i < WEIGHTS.length - 1; i++) {
    w += WEIGHTS[i]
  }
  console.log(`${w} ${WEIGHTS[3]}`)
  console.log(`${WIDE[1]} ${WIDE[2]} ${MASKS[2]} ${MASKS.length}`)
}
