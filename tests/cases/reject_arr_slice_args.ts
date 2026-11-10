// `slice` takes a start and an end at most.
export const main = (): number => {
  const xs: number[] = [3, 1, 2]
  return xs.slice(0, 1, 2).length
}
