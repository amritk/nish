// biome-ignore-all lint/plugin: the declared shape is what the example measures
// biome-ignore-all lint/suspicious/useAwait: an `async` function with no wait is the shape measured
// Class no-wait: `async` with no await at all.
async function label(x: i32): Promise<i32> {
  return x + 1
}

export async function main(): Promise<i32> {
  const answer = await label(1)
  console.log(answer)
  return 0
}
