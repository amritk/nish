// The branch between `?` and `:` inside a `for` head's initialiser reads `in`
// as the operator again, as the ECMAScript grammar does; the one after `:`
// keeps the head's rule.
class O {
  v: i32 = 1
}

export const run = (o: O): i32 => {
  let n: i32 = 0
  for (let i = true ? "v" in o : false; n < 1; n++) {
  }
  return n
}
