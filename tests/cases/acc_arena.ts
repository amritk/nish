// Self-recursive sums whose frames allocate on the arena, emitted as one loop
// (src/emit-accumulate.ts, "Arena scope"). Each frame builds a string the
// next frame cannot reach, so the loop releases the frame's arena scope at
// the end of every step, as each frame of the recursion does on its return.

// A template per frame: the sum of the lengths of `${n}`, `${n - 1}`, ... `${1}`.
const digits = (n: i32): i32 => {
  if (n <= 0) {
    return 0
  }
  const s = `${n}`
  return s.length + digits(n - 1)
}

// A string parameter passed through unchanged: `tag` is the caller's, older
// than the mark, so releasing each step's `${tag}${n}` leaves it whole.
const tagged = (tag: string, n: i32): i32 => {
  if (n <= 0) {
    return tag.length
  }
  const s = `${tag}${n}`
  return s.length + tagged(tag, n - 1)
}

export const main = (): i32 => {
  // With an argument, digits runs that many frames: a long run to time.
  const many: i32 = process.argv.length > 1 ? parseInt(process.argv[1]) : 1000
  console.log(`${digits(12)} ${tagged("ab", 5)} ${tagged("", 0)}`)
  console.log(`${digits(many)} ${tagged("nish", 1000)}`)
  // A tag the caller built on the arena: it is older than tagged's mark only
  // if the mark is taken on entry, so a mark taken too low would free it.
  const word = `w${many % 7}`
  console.log(`${tagged(word, 4)} ${word}`)
  return 0
}
