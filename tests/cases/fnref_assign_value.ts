// WP51 stage 2: an assignment used as a value stores into its target and
// passes the same function on, as an argument, an initialiser or a return,
// so both places hold it and each call through them dispatches over it.
type F = (x: i32) => i32

const sq = (x: i32): i32 => x * x
const plus1 = (x: i32): i32 => x + 1
const dbl = (x: i32): i32 => x * 2
const k = (f: F): i32 => f(1)

const pick = (n: i32): F => {
  let r: F = sq
  if (n > 0) {
    return (r = dbl)
  }
  return r
}

export const main = (): void => {
  let r: F = sq
  const x = k((r = plus1))
  const h: F = (r = dbl)
  console.log(`${x} ${r(3)} ${h(5)} ${pick(1)(7)} ${pick(0)(7)}`)
}
