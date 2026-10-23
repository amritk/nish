// A string's `.length` through a `?.` chain is `strLenOpt` of the chain, which
// stops at `null` as `?.` does; a narrowed `string | null` is a string, so its
// `.length` is `strLen`; an array's `.length` stays as written. A byte-offset
// method in a `?.` chain stays as written too, right for ASCII text only.

class Box {
  name: string
  constructor(name: string) {
    this.name = name
  }
}

const pick = (on: boolean, s: string): string | null => (on ? s : null)
const box = (on: boolean): Box | null => (on ? new Box("a😀b") : null)

export const main = (): number => {
  const some: string | null = pick(true, "héllo")
  const none: string | null = pick(false, "héllo")
  console.log(`${some?.length ?? -1} ${none?.length ?? -1}`)
  console.log(`${box(true)?.name.length ?? -1} ${box(false)?.name.length ?? -1}`)
  if (some !== null) {
    console.log(`${some.length}`)
  }
  const xs: number[] = [1, 2, 3]
  console.log(`${xs.length}`)
  const word: string | null = pick(true, "hello")
  console.log(word?.slice(1, 3) ?? "-")
  return 0
}
