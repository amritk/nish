// --deny-panics accepts the callback methods: each template's `xs[i]` sits
// under its loop's `i < xs.length` guard, which proves it, and the `push`
// that grows `map`'s and `filter`'s answer is an `oom` site, not a panic.
export const main = (): void => {
  const xs: number[] = [3, 1, 2]
  const ys = xs.map((x) => x > 1)
  const zs = xs.filter((x, i) => x > i)
  console.log(`${ys.length} ${zs.length} ${xs.some((x) => x > 2)} ${xs.every((x) => x > 0)} ${xs.findIndex((x) => x === 2)}`)
}
