// The async functions `main.ts` awaits, spawns and gathers. Their frames are
// laid out here, so `main`'s frame, which holds theirs, is sized only once
// both modules are emitted.
async function square(x: i32): Promise<i32> {
  return x * x
}

export async function sum(x: i32, y: i32): Promise<i32> {
  const a = await square(x)
  const b = await square(y)
  return a + b
}

export async function label(name: string, n: i32): Promise<string> {
  const s = await sum(n, n + 1)
  return `${name}=${s}`
}

export async function report(n: i32): Promise<void> {
  const s = await sum(n, 1)
  console.log(`report ${s}`)
}
