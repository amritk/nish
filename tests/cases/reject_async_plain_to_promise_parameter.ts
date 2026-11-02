// A plain function passed where the function type answers a `Promise<T>`:
// the callee awaits it, and only an async function is awaited (NL2622).
async function run(g: (x: i32) => Promise<i32>, v: i32): Promise<i32> {
  return await g(v)
}

function twice(x: i32): i32 {
  return x * 2
}

async function start(): Promise<void> {
  const a = await run(twice, 1)
}

export const main = (): i32 => 0
