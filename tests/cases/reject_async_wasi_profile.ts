// `--profile wasi` builds a wasm module, which has no event loop to resume a
// task, so an `async` function is refused there too (NL2634).
async function double(x: i32): Promise<i32> {
  return x * 2
}

async function run(): Promise<void> {
  const x = await double(3)
  console.log(x)
}

export const main = (): i32 => 0
