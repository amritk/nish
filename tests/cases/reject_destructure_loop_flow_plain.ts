// The hand-written twin of `reject_destructure_loop_flow`: the same
// diagnostic, at the same `===`.
enum Kind { A, B, C }
const f = (p: number[], n: number): number => {
  let j = Kind.A
  let i = 0
  let s = 0
  while (j !== Kind.C) {
    const a = p[0]
    const b = p[1]
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
