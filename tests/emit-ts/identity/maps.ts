// A class-A program: a Map counted into, read back and iterated in insertion
// order, which native and Node both keep.

const words = (): string[] => ["red", "green", "red", "blue", "green", "red"]

export const main = (): number => {
  const counts = new Map<string, number>()
  for (const w of words()) {
    const seen = counts.get(w)
    counts.set(w, seen === undefined ? 1 : seen + 1)
  }
  for (const word of counts.keys()) {
    console.log(`${word}: ${counts.get(word) ?? 0}`)
  }
  console.log(`distinct ${counts.size}`)
  console.log(`has blue ${counts.has("blue")}, has pink ${counts.has("pink")}`)
  return 0
}
