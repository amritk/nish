// WP49: failure travels as `Promise<Result<T, E>>`: the awaited answer is an
// ordinary `Result`, tested before its value is read.
async function parse(s: string): Promise<Result<i32, string>> {
  if (s.length === 0) {
    return Err("empty")
  }
  return Ok(s.length * 10)
}

async function total(a: string, b: string): Promise<Result<i32, string>> {
  const x = await parse(a)
  if (x.isErr()) {
    return Err(x.error)
  }
  const y = await parse(b)
  if (y.isErr()) {
    return Err(y.error)
  }
  return Ok(x.value + y.value)
}

export async function main(): Promise<i32> {
  const good = await total("ab", "cde")
  if (good.isOk()) {
    console.log(good.value)
  }
  const bad = await total("ab", "")
  if (bad.isErr()) {
    console.log(bad.error)
  }
  return 0
}
