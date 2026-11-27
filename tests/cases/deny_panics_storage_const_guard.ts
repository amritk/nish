// examples-strict S1 (#2316): the change that proves module storage's length
// also lets a guard order a sum against a folded module constant, where it
// read only literals before (a function `const` and a `.length` were already
// read). `depth > LIMIT` returns, so the `depth + 1` after it, in the loop and
// past the guard's `||`, holds `depth` at most 1000 and cannot overflow: it
// compiles under --deny-panics and the IR keeps no overflow check. The name
// says storage because the widened guard is the storage prover's change.
const LIMIT: i32 = 1000

// Where the scan of `text` from `at` ends, or -1 when it runs off the end or
// recurses past `LIMIT`.
const walk = (text: string, at: i32, depth: i32): i32 => {
  if (at >= text.length || depth > LIMIT) {
    return -1
  }
  let j = at
  while (j >= 0 && j < text.length) {
    if (text.charCodeAt(j) === 41) {
      return j + 1
    }
    const end = walk(text, j + 1, depth + 1)
    if (end < 0) {
      return end
    }
    j = end
  }
  return j
}

export const main = (): void => {
  console.log(`${walk("(a))", 0, 0)} ${walk("abc", 0, 1001)} ${walk("abc", 0, 0)}`)
}
