// A string's `.length` through a `?.` chain is `strLenOpt` of the chain, which
// stops at `null` as `?.` does; a narrowed `string | null` is a string, so its
// `.length` is `strLen`; an array's `.length` stays as written. A byte-offset
// method in a `?.` chain stays as written too, right for ASCII text only. The
// chain's receiver is evaluated once, so `counted` bumps its counter once.
import { strLenOpt, strLen } from "nish/runtime"

class Box {
  name: string
  constructor(name: string) {
    this.name = name
  }
}

const pick = (on: boolean, s: string): string | null => (on ? s : null)
const box = (on: boolean): Box | null => (on ? new Box("a😀b") : null)

class Counter {
  hits: number
  constructor() {
    this.hits = 0
  }
}

const counted = (c: Counter, on: boolean): Box | null => {
  c.hits = c.hits + 1
  return box(on)
}

export const main = (): number => {
  const some: string | null = pick(true, "héllo")
  const none: string | null = pick(false, "héllo")
  console.log(`${strLenOpt(some) ?? -1} ${strLenOpt(none) ?? -1}`)
  console.log(`${strLenOpt(box(true)?.name) ?? -1} ${strLenOpt(box(false)?.name) ?? -1}`)
  if (some !== null) {
    console.log(`${strLen(some)}`)
  }
  const xs: number[] = [1, 2, 3]
  console.log(`${xs.length}`)
  const word: string | null = pick(true, "hello")
  console.log(word?.slice(1, 3) ?? "-")
  const calls = new Counter()
  console.log(`${strLenOpt(counted(calls, true)?.name) ?? -1} ${calls.hits}`)
  console.log(`${strLenOpt(counted(calls, false)?.name) ?? -1} ${calls.hits}`)
  return 0
}
