// `orReturn` after a read of state the call may change: `this.pos` and
// `this.xs[0]` are read before `read` runs and advances them, so the call
// cannot run ahead of the statement and takes the throw path. A local read
// before it needs no such care: no call can reach a local.
class Reader {
  pos: i32
  xs: i32[]
  constructor() {
    this.pos = 0
    this.xs = [7]
  }
  read(): Result<i32, string> {
    this.pos = this.pos + 1
    this.xs[0] = this.xs[0] + 1
    return this.pos < 3 ? Ok(this.pos) : Err(`end at ${this.pos}`)
  }
  step(): Result<i32, string> {
    const v = this.pos * 100 + this.read().orReturn()
    return Ok(v)
  }
  peek(): Result<i32, string> {
    const v = this.xs[0] * 10 + this.read().orReturn()
    return Ok(v)
  }
}

const local = (r: Reader): Result<i32, string> => {
  let n: i32 = 5
  const v = n + r.read().orReturn()
  n = v
  return Ok(n)
}

const show = (r: Result<i32, string>): string => (r.isOk() ? `ok ${r.value}` : `err ${r.error}`)

export const main = (): number => {
  const r = new Reader()
  console.log(show(r.step()))
  console.log(show(r.peek()))
  console.log(show(r.step()))
  console.log(show(local(new Reader())))
  return 0
}
