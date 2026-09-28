// The lexer-shaped cursor of wp15 §2.3, committed so that the 1.069x of wp15
// item 6 is a number anyone can re-derive (WP31 §10 step 1). `scan` walks a
// string with a cursor the body advances by a variable amount -- a run of
// letters, a run of digits, or one byte of anything else -- which is what
// `for (const c of s)` cannot express and what `src/lexer.ts` is made of.
//
// Every `charCodeAt` in `scan` is proven by the loop condition that guards it,
// so the default build and the `--unchecked-indexing` build emit the same
// `@scan`, byte for byte; `tests/cases/str_bounds_proven` pins the shape. The
// one check left in the module is `process.argv[1]`, which runs once.
//
// The cursor's bound is `s.length`, which no `integer<Lo, Hi>` can state
// (wp31 §2). Declaring it `integer<0, …>` anyway turns each advance into a
// range entry the proof cannot place, and each gets wp31 §8's warning:
// `tests/run.js` compiles that twin of this file and counts them.
//
//   cat src/*.ts > build/cursor.txt
//   build/nish bench/cursor.ts --link build/cursor --profile speed
//   build/nish bench/cursor.ts --link build/cursor-unchecked --profile speed --unchecked-indexing
//   build/cursor build/cursor.txt
//
// wp31 §10 records the protocol and the numbers.

const PASSES: i32 = 400 // bench:n

const isAlpha = (c: i32): boolean => (c >= 97 && c <= 122) || (c >= 65 && c <= 90) || c === 95

const isDigit = (c: i32): boolean => c >= 48 && c <= 57

// Answers a checksum of what one pass found: words, numbers and other bytes,
// each weighted so that a scan that miscounts one kind moves the sum.
const scan = (s: string): i32 => {
  let words = 0
  let numbers = 0
  let other = 0
  let i = 0
  while (i < s.length) {
    const c = s.charCodeAt(i)
    if (isAlpha(c)) {
      words = words + 1
      while (i < s.length && (isAlpha(s.charCodeAt(i)) || isDigit(s.charCodeAt(i)))) {
        i = i + 1
      }
    } else if (isDigit(c)) {
      numbers = numbers + 1
      while (i < s.length && isDigit(s.charCodeAt(i))) {
        i = i + 1
      }
    } else {
      other = other + 1
      i = i + 1
    }
  }
  return words * 7 + numbers * 3 + other
}

export const main = (): number => {
  if (process.argv.length < 2) {
    console.log("usage: cursor <file>")
    return 2
  }
  const text = readFileSync(process.argv[1])
  let checksum: i64 = 0
  let pass = 0
  while (pass < PASSES) {
    checksum = checksum + toI64(scan(text))
    pass = pass + 1
  }
  console.log(`${text.length} bytes, ${PASSES} passes, checksum ${checksum}`)
  return 0
}
