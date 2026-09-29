// A `for` head's initialiser reads `in` as the loop's, and an array literal
// inside it reads it as the operator again, as the ECMAScript grammar and Node
// do. TypeScript's parser keeps it disallowed there and reports a syntax error,
// so `tests/parser-oracle.js` counts this file as skipped.
class O {
  v: i32 = 1
}

const check = (b: boolean): i32 => 0

export const run = (o: O): i32 => {
  let n: i32 = 0
  for (let i = [1 in {}].length; i < 1; i++) {
    n = n + check(false)
  }
  return n
}
