// `xs.slice()`, `xs.slice(start)` and `xs.slice(start, end)` copy into a new
// array with string `slice`'s rule: `0 <= start <= end <= xs.length`, the same
// copies Node makes for any range inside it. Writing the copy leaves the
// original alone.

const show = (xs: readonly number[]): string => xs.map((x) => `${x}`).join(",")

export const main = (): void => {
  const xs: number[] = [3, 1, 2, 5]
  const all = xs.slice()
  all[0] = 99
  console.log(`${show(all)} ${show(xs)}`)
  console.log(`${show(xs.slice(1))} ${show(xs.slice(1, 3))}`)
  console.log(`[${show(xs.slice(4))}] [${show(xs.slice(2, 2))}] ${xs.slice(0, 4).length}`)
  const ro: readonly string[] = ["a", "b", "c"]
  console.log(ro.slice(1).join(""))
  console.log("hello".slice(1, 3))
}
