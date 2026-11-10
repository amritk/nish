// A `Map` in a child region keyed by the parent's nodes: the child counts
// what it was handed without copying a key.
import { Region, childWith, enter, free, region } from "nish:region"

class Word {
  text: string
  constructor(text: string) {
    this.text = text
  }
}

class Words {
  all: Word[]
  constructor() {
    this.all = [new Word("alpha"), new Word("beta"), new Word("gamma")]
  }
}

class Tally {
  counts: Map<Word, i32>
  constructor(words: Words) {
    this.counts = new Map<Word, i32>()
    for (let pass: i32 = 0; pass < 3; pass++) {
      for (let k: i32 = 0; k <= pass && k < words.all.length; k++) {
        const word = words.all[k]
        this.counts.set(word, (this.counts.get(word) ?? 0) + 1)
      }
    }
  }
}

const load = (): Words => new Words()
const count = (words: Words): Tally => new Tally(words)
const tally = (words: Words): Region<Tally> => childWith(words, count)
const report = (t: Tally): i32 => {
  let total: i32 = 0
  for (const word of t.counts.keys()) {
    const n = t.counts.get(word) ?? 0
    console.log(`${word.text} ${n}`)
    total = total + n
  }
  return total
}

export const main = (): i32 => {
  const parent: Region<Words> = region(load)
  const child: Region<Tally> = enter(parent, tally)
  console.log(enter(child, report))
  free(parent)
  return 0
}
