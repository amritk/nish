// Opt-out from `--deny-panics`: the `Map` and `Set` calls reach panic sites in
// `std/collections`; this file keeps none of its own. Follow-up: make
// `std/collections` panic-free, then build this file with `--deny-panics`.
//
// The global `Map` and `Set` (docs/wp32-map.md): no import, JavaScript's
// semantics, and one probe of a fingerprinted table per `set`, `add`, `has` or
// `delete`.
//   nish examples/sets.ts --link build/sets && ./build/sets
// prints what it finds in a short text: how many words it has, how many of them
// are distinct, which ones repeat, and how many of those also appear in a second
// list. Under Node the same file runs on Node's own `Map` and `Set`
// (`node --experimental-strip-types --import ./runtime/nish.mjs`) and prints the
// same lines.

/** The words of `text`: runs of lowercase letters, in order. */
const words = (text: string): string[] => {
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
  const text = "the cat sat on the mat and the dog sat on the log"
  const all = words(text)
  const seen = new Set<string>()
  const repeated: Map<string, boolean> = new Map()
  for (const word of all) {
    if (seen.has(word)) {
      repeated.set(word, true)
    }
    seen.add(word)
  }
  console.log(`${all.length} words, ${seen.size} distinct, ${repeated.size} repeated`)
  const line: string[] = ["repeated:"]
  for (const word of all) {
    // Each repeated word once, in the order it first repeats: `delete` answers
    // true only the first time.
    if (repeated.delete(word)) {
      line.push(word)
    }
  }
  console.log(line.join(" "))
  const pets = ["dog", "cat", "fish"]
  // `u32` cannot overflow-panic, and the count stays below the three pets.
  let common: u32 = 0
  for (const pet of pets) {
    if (seen.has(pet)) {
      common++
    }
  }
  console.log(`${common} of ${pets.length} pets are in the text, ${repeated.size} repeats left to print`)
}
