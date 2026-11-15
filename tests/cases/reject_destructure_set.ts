// A `Set` has no index, so an array pattern over one is refused.
export const main = (): void => {
  const s = new Set<number>()
  s.add(1)
  const [a] = s
  console.log(a)
}
