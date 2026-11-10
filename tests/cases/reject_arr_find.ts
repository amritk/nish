// `find` is refused with a pointer to `findIndex`: TypeScript types its answer
// `T | undefined`, so `r !== null` would pass `tsc` and be true under Node for
// an element that is not there.
export const main = (): number => {
  const xs: number[] = [3, 1, 2]
  const r = xs.find((x) => x > 5)
  return r !== null ? 1 : 0
}
