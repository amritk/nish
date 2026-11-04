// An async function under a wasm target: its task is resumed by the native
// event loop, which a wasm module does not have (NL2652).
async function load(x: i32): Promise<i32> {
  return x
}

export const main = (): i32 => 0
