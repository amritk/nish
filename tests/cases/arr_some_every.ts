// `xs.some(pred)` and `xs.every(pred)` compile to `std/array`'s loops, which
// stop at the first element that decides the answer: `seen` records each
// element a predicate was called with, as Node's `Array.prototype` calls it.

export const main = (): void => {
  const xs: number[] = [3, 1, 7, 5]
  const empty: number[] = []
  const seen: number[] = []
  console.log(`${xs.some((x) => { seen.push(x); return x > 4 })} ${seen.length}`)
  console.log(`${xs.every((x) => { seen.push(x); return x < 2 })} ${seen.length}`)
  console.log(`${xs.every((x) => x > 0)} ${xs.some((x) => x > 9)}`)
  console.log(`${xs.some((x, i) => x === i)} ${xs.every((x, i) => x > i)}`)
  console.log(`${empty.some((x) => x > 0)} ${empty.every((x) => x > 0)}`)
}
