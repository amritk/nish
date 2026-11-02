// `+=` of an `await`: only `=` takes one, so the answer is named first
// (NL2624).
async function load(x: i32): Promise<i32> {
  return x
}

async function run(): Promise<void> {
  let total: i32 = 0
  total += await load(1)
}

export const main = (): i32 => 0
