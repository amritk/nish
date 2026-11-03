// `xs.sort(cmp)`: stable, in place, and answering the receiver. Each comparator
// is an instantiation of std/sort's merge sort that calls it directly.

const ascending = (a: number, b: number): number => a - b

/** A generic function hands its own comparator on: one instantiation per caller. */
const sorted = <T>(xs: T[], cmp: (a: T, b: T) => number): T[] => xs.sort(cmp)

const show = (xs: number[]): string => {
  const parts: string[] = []
  for (const x of xs) {
    parts.push(`${x}`)
  }
  return parts.join(" ")
}

export const main = (): number => {
  const xs = [17, 3, 99, -4, 42, 8, 0, 23, 15, 61, 7, 88, -12, 5, 30, 2, 71, 19, 44, 1]
  xs.sort(ascending)
  console.log(show(xs))
  xs.sort((a, b) => b - a)
  console.log(show(xs))
  const empty: number[] = []
  console.log(`${empty.sort(ascending).length}`)
  const one = [7]
  console.log(show(one.sort(ascending)))
  const pair = [2, 1]
  console.log(`${pair.sort(ascending) === pair} ${pair[0]}`)
  // Ties keep their order: these are equal by length.
  const words = ["pear", "fig", "apple", "kiwi", "yam", "plum", "lime", "date"]
  console.log(sorted(words, (a, b) => a.length - b.length).join(","))
  return 0
}
