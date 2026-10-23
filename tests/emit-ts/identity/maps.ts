// A class-A program: a Map tallied into, read back and iterated in insertion
// order, which native and Node both keep. The tally is a string of marks, so
// no i32 addition (a checked one under `--emit-ts`) is in the way.

const words = (): string[] => ["red", "green", "red", "blue", "green", "red"]

export const main = (): number => {
  const counts = new Map<string, string>()
  for (const w of words()) {
    const seen = counts.get(w)
    counts.set(w, seen === undefined ? "*" : seen + "*")
  }
  for (const word of counts.keys()) {
    console.log(`${word}: ${counts.get(word) ?? ""}`)
  }
  console.log(`distinct ${counts.size}`)
  console.log(`has blue ${counts.has("blue")}, has pink ${counts.has("pink")}`)
  return 0
}
