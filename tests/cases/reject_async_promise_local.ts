// A local annotated `Promise<T>`: a promise is never held to be awaited
// later (NL2619).
async function load(x: i32): Promise<i32> {
  return x
}

async function run(): Promise<void> {
  const p: Promise<i32> = load(1)
}

export const main = (): i32 => 0
