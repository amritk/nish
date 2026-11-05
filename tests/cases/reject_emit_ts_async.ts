// --emit-ts refuses an async function (NL4016): the native build runs it as a
// frame state machine whose resume order the TypeScript runtime does not answer
// yet, so nothing is written.
async function double(x: i32): Promise<i32> {
  return x * 2
}

async function twice(x: i32): Promise<i32> {
  const a = await double(x)
  const b = await double(a)
  return a + b
}

export async function main(): Promise<void> {
  const t = await twice(3)
  console.log(t)
}
