// A line that starts with `(` or `[` continues the expression before it, and a
// `++` at the start of a line is a prefix operator of a new statement. Both are
// TypeScript's reading, so the program prints what Node prints: `5 10 1 2`.
const twice = (x: i32): i32 => x * 2

export const main = (): number => {
  const xs: i32[] = [4, 5, 6]
  const picked = xs
    [1]
  const doubled = twice
    (picked)
  let a: i32 = 1
  let b: i32 = 5
  b = a
  ++b
  console.log(`${picked} ${doubled} ${a} ${b}`)
  return 0
}
