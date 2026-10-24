// `orReturn` in a declarator after the first: the earlier declarator binds a
// name the later one may read, so the later call cannot run ahead of the
// statement (it would read `a` before it is bound) and takes the throw path.
// The first declarator's call still hoists, as `c`'s does in `chained`.
const id = (n: i32): Result<i32, string> => (n > 3 ? Ok(n) : Err(`${n} is too small`))

const pair = (n: i32): Result<i32, string> => {
  const a = n + 1, b = id(a).orReturn()
  return Ok(a + b)
}

const chained = (n: i32): Result<i32, string> => {
  const c = id(n).orReturn(), d = id(c - 1).orReturn()
  return Ok(c * 10 + d)
}

const count = (n: i32): Result<i32, string> => {
  let total: i32 = 0
  for (let i = n, r = id(i).orReturn(); i < n + 3; i = i + 1) {
    total = total + r
  }
  return Ok(total)
}

const show = (r: Result<i32, string>): string => (r.isOk() ? `ok ${r.value}` : `err ${r.error}`)

export const main = (): number => {
  console.log(show(pair(5)))
  console.log(show(pair(1)))
  console.log(show(chained(5)))
  console.log(show(chained(4)))
  console.log(show(chained(3)))
  console.log(show(count(4)))
  console.log(show(count(2)))
  return 0
}
