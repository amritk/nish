// Refused with NL4014 at `xs.push(v)`: this program holds `P` inline, and
// `put` is called at no type, so nothing says whether the push copies a
// record in or stores a reference.
interface P {
  x: i32
}

const put = <T>(xs: T[], v: T): void => {
  xs.push(v)
}

export const main = (): number => {
  const ps: P[] = [{ x: 1 }]
  console.log(`${ps.length}`)
  return 0
}
