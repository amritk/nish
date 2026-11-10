// `xs.map(f)` and the template it compiles to, imported and called by name,
// are one instantiation: `map` is defined once for `double` and both calls are
// direct calls to it, with no function pointer (checked in tests/run.js).

import { map } from "nish/array"

const double = (x: number): number => x * 2

const show = (xs: readonly number[]): string => xs.map((x) => `${x}`).join(",")

export const main = (): void => {
  const xs: number[] = [3, 1, 2]
  const a = xs.map(double)
  const b = map(xs, double)
  console.log(`${show(a)} ${show(b)}`)
}
