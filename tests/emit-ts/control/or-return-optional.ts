// `orReturn` under an optional link: past a `?.` that finds null nothing to its
// right runs, so a call there cannot run ahead of the statement and takes the
// throw path. A null receiver with an argument that would fail returns `ok`.
// (`?.[`, the other link an argument can sit under, is refused by Nish.)
const parse = (s: string): Result<i32, string> => (s === "one" ? Ok(1) : Err(`cannot parse ${s}`))

class Table {
  base: i32
  constructor(base: i32) {
    this.base = base
  }
  get(k: i32): i32 {
    return this.base + k
  }
}

const look = (t: Table | null, s: string): Result<i32, string> => {
  const v = t?.get(parse(s).orReturn()) ?? 0
  return Ok(v)
}

const show = (r: Result<i32, string>): string => (r.isOk() ? `ok ${r.value}` : `err ${r.error}`)

export const main = (): number => {
  console.log(show(look(new Table(10), "one")))
  console.log(show(look(new Table(10), "six")))
  console.log(show(look(null, "six")))
  return 0
}
