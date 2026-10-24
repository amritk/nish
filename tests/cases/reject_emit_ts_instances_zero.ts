// WP33 R4: `--emit-ts` writes a generic's body once for all its instances, so
// one whose instances fill a new array with different zeros is refused
// (NL4013): `make` at `i32` fills with `0` and at `i64` with `0n`.
const make = <T>(like: T[], n: i32): T[] => {
  const out = new Array<T>(n)
  return out
}

export const main = (): number => {
  const a: i32[] = [1]
  const one: i64 = 1
  const b: i64[] = [one]
  console.log(`${make(a, 2).length} ${make(b, 3).length}`)
  return 0
}
