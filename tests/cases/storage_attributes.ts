// WP50 stage 3: module storage is memory every function can reach, so it moves
// the inferred attributes. A function that touches none stays `readnone`; one
// that reads storage (here only its length, so it cannot panic) is `readonly`
// and never `readnone`; one that writes storage is neither.
const COUNTS = new Int32Array(4)

const pure = (i: i32): i32 => i * 3

const size = (): i32 => COUNTS.length

const bump = (i: i32): void => {
  COUNTS[i] = COUNTS[i] + 1
}

export const main = (): void => {
  bump(2)
  bump(2)
  console.log(`${pure(2)} ${size()} ${COUNTS[2]}`)
}
