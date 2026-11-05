async function inc(x: i32): Promise<i32> {
  return x + 1
}

async function step(x: i32): Promise<i32> {
  const a = await inc(x)
  return a * 2
}

export async function main(): Promise<i32> {
  const n = await step(1)
  console.log(n)
  return 0
}
