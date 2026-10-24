// Refused with NL4014 at `new Array<T>(n)`: `make` is called at no type, so
// nothing says whether its slots are filled with `0`, `0n` or `false`.
const make = <T>(like: T[], n: i32): T[] => {
  const out = new Array<T>(n)
  return out
}

export const main = (): number => {
  console.log("never written")
  return 0
}
