// A block inside a `for` head's initialiser, here an arrow's body, reads `in`
// as the operator again.
class O {
  v: i32 = 1
}

const check = (b: boolean): i32 => 0

export const run = (o: O): i32 => {
  let n: i32 = 0
  for (let i = check((() => { return "v" in o })()); i < 1; i++) {
    n = n + check(false)
  }
  return n
}
