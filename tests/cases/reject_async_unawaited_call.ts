// A call to an async function with no `await`: its promise would be a value
// (NL2645).
async function load(x: i32): Promise<i32> {
  return x
}

async function run(): Promise<void> {
  const p = load(1)
}

export const main = (): i32 => 0
