// Loop-flow sees through a pattern: `j` leaves the loop as `Kind.C` here as
// in the hand-written twin, `reject_destructure_loop_flow_plain`, so the
// `===` after it is refused in both.
enum Kind { A, B, C }
const f = (p: number[], n: number): number => {
  let j = Kind.A
  let i = 0
  let s = 0
  while (j !== Kind.C) {
    const [a, b] = p
    s += a + b
    if (i > n) { j = Kind.C } else { j = Kind.B }
    i++
  }
  if (j === Kind.A) { return 1 }
  return s
}
export const main = (): void => {
  console.log(`${f([1, 2], 3)}`)
}
