// biome-ignore-all lint/plugin: the declared shape is what the example measures
// Shape: an `async` function on a cycle of awaits.
async function countdown(n: i32): Promise<i32> {
  if (n === 0) {
    return 0
  }
  const rest = await countdown(n - 1)
  return rest + 1
}

export async function main(): Promise<i32> {
  const answer = await countdown(3)
  console.log(answer)
  return 0
}
