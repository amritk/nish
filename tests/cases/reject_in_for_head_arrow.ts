// A concise arrow body inherits the `for` head's rule, and the array literal
// around it reads `in` as the operator again (`reject_in_for_head_array` has
// why TypeScript's parser disagrees).
class O {
  v: i32 = 1
}

const check = (b: boolean): i32 => 0

export const run = (o: O): i32 => {
  let n: i32 = 0
  for (let i = [() => "x" in o][0] ? 0 : 1; i < 1; i++) {
    n = n + check(false)
  }
  return n
}
