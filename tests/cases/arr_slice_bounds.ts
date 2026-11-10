// `xs.slice(start, end)` panics outside `0 <= start <= end <= xs.length`, with
// string `slice`'s words, where JavaScript would clamp or count from the end
// (checked in tests/run.js: the first line prints, then the panic, exit 1).

const show = (xs: readonly number[]): string => xs.map((x) => `${x}`).join(",")

export const main = (): void => {
  const xs: number[] = [3, 1, 2]
  console.log(show(xs.slice(1, 3)))
  console.log(show(xs.slice(2, 5)))
}
