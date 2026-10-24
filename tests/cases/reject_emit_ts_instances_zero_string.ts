// WP33 R4: `--emit-ts` writes a generic's body once for all its instances, so
// one whose instances fill a new array with different zeros is refused
// (NL4013): `make` at `i32` fills with `0` and at `string | null` with `null`.
const make = <T>(like: T[], n: i32): T[] => {
  const out = new Array<T>(n)
  return out
}

export const main = (): number => {
  const a: i32[] = [1]
  const b: (string | null)[] = []
  b.push("x")
  console.log(`${make(a, 2).length} ${make(b, 3).length}`)
  return 0
}
