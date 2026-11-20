// Word count on the global `Map`, and the two calls `nish/map` adds to it
// (docs/wp32-map.md §9). Each count below is one hash and one probe of the
// table per word: `counts.set(w, (counts.get(w) ?? 0) + 1)` asks about `w`
// twice, and the compiler keeps the first probe's answer and writes through
// it; `getOrInsert` is one probe by construction; and `reserve` sizes the
// table once, so counting never has to grow it.
//   nish examples/wordcount.ts --link build/wordcount && ./build/wordcount
// Under Node the same file runs on Node's own `Map`, where `reserve` does
// nothing and `getOrInsert` is a `get` and a `set`, and prints the same lines:
//   node --experimental-strip-types --import ./runtime/nish.mjs \
//     -e 'import("./examples/wordcount.ts").then((m) => m.main())'
import { getOrInsert, reserve } from "nish/map"

/** The words of `text`: runs of lowercase letters, in order. */
const splitWords = (text: string): string[] => {
  const out: string[] = []
  let start: i32 = -1
  for (let i: i32 = 0; i < toI32(text.length); i++) {
    const c: i32 = toI32(text.charCodeAt(i))
    const letter = c >= 97 && c <= 122
    if (letter && start < 0) {
      start = i
    } else if (!letter && start >= 0 && start < i) {
      out.push(text.substring(start, i))
      start = -1
    }
  }
  // A word that runs to the end of the text ends there.
  if (start >= 0) {
    out.push(text.substring(start))
  }
  return out
}

export const main = (): void => {
  const text = "the cat sat on the mat and the dog sat on the log by the cat"
  const all = splitWords(text)
  // A count is a `u32`, which cannot overflow-panic: it stays below the
  // number of words.
  const counts = new Map<string, u32>()
  reserve(counts, all.length)
  for (const w of all) {
    counts.set(w, (counts.get(w) ?? 0) + 1)
  }
  // Where each word first appears: the insert happens only the first time.
  const first = new Map<string, number>()
  for (let at: i32 = 0; at < toI32(all.length); at++) {
    getOrInsert(first, all[at], at)
  }
  console.log(`${all.length} words, ${counts.size} distinct`)
  for (const w of counts.keys()) {
    console.log(`${w} ${counts.get(w) ?? 0} (first at ${first.get(w) ?? -1})`)
  }
}
