// Panic sites: a generic function's sites are its instantiations', each
// listed under its own symbol and decided over its own side tables, so the
// call into each is a site of its own.
const at = <T>(xs: T[], i: i32): T => xs[i]

export const main = (): number => {
  const ns: i32[] = [1, 2, 3]
  const ss: string[] = ["a", "b"]
  console.log(at(ns, 2))
  console.log(at(ss, parseInt("1")))
  return 0
}
