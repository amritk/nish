// An argument list inside a `for` head's initialiser reads `in` as the
// operator again.
class O {
  v: i32 = 1
}

const check = (b: boolean): i32 => 0

export const run = (o: O): i32 => {
  let n: i32 = 0
  for (let i = check("a" in {}); i < 1; i++) {
    n = n + check(false)
  }
  return n
}
