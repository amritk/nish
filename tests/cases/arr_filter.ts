// `xs.filter(pred)` compiles to `std/array`'s `filter` or `filterIndexed`: a
// new array of the elements kept, in order. The original is unchanged, and a
// kept interface record is a copy, so writing it leaves the original's alone;
// `--emit-ts` copies it too (`copyRecords`), where Node's own would share it.

interface Item {
  id: number
  keep: boolean
}

const isOdd = (x: number): boolean => x % 2 === 1

const show = (xs: readonly number[]): string => xs.map((x) => `${x}`).join(",")

export const main = (): void => {
  const xs: number[] = [3, 1, 2, 5, 8]
  console.log(show(xs.filter(isOdd)))
  console.log(show(xs.filter((x, i) => i % 2 === 0)))
  console.log(`[${show(xs.filter((x) => x > 100))}] ${show(xs)}`)
  const items: Item[] = [
    { id: 1, keep: true },
    { id: 2, keep: false },
    { id: 3, keep: true },
  ]
  const kept = items.filter((it) => it.keep)
  kept[0].id = 10
  console.log(`${kept.length} ${kept[0].id} ${kept[1].id} ${items[0].id}`)
  const names: readonly string[] = ["ann", "bob", "cy"]
  console.log(names.filter((n) => n.length === 3).join(" "))
}
