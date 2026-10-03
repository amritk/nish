// NL2303: `T` here is the element type of the argument, not its type, and the
// fix proves inference only for a parameter annotated `T`; no fix.
const first = <T>(xs: T[]): T => xs[0]
export const test = (): number => {
  const xs: i32[] = [1, 2]
  return first<i32>(xs)
}
