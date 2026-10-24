// Refused with NL4014 at `new Array<T>(n)`, though `n`'s `u64` alone would make
// `fill` a stub: a zero no call names is refused in the program's own code
// whatever else the body spells.
const fill = <T>(like: T[], n: u64): T[] => {
  const out = new Array<T>(toI32(n))
  return out
}

export const main = (): number => {
  console.log("never written")
  return 0
}
