// An element access inside a `for` head's initialiser reads `in` as the
// operator again, so this parses; Phase 0 then refuses the key's shape, which
// it checks before the key's operands.
class O {
  v: i32 = 1
}

const check = (b: boolean): i32 => 0

export const run = (o: O): i32 => {
  let n: i32 = 0
  for (let i = n + [1][o.v in o ? 0 : 0]; i < 1; i++) {
    n = n + check(false)
  }
  return n
}
