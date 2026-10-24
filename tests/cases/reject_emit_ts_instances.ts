// WP33 R4: `--emit-ts` writes a generic's body once for all its instances, so
// one whose instances need different TypeScript is refused (NL4013): `put` at
// `P` copies the record it pushes, which `P` holds inline, and at `P | null`
// pushes the reference.
interface P {
  x: i32
}

const put = <T>(xs: T[], v: T): void => {
  xs.push(v)
}

export const main = (): number => {
  const ps: P[] = []
  const qs: (P | null)[] = []
  const p: P = { x: 1 }
  const q: P | null = null
  put(ps, p)
  put(qs, q)
  console.log(`${ps.length} ${qs.length}`)
  return 0
}
