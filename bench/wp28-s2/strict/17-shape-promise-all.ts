// biome-ignore-all lint/plugin: the declared shape is what the example measures
// biome-ignore-all lint/suspicious/useAwait: an `async` function with no wait is the shape measured
// Shape: calls gathered by `Promise.all`.
async function next(x: i32): Promise<i32> {
  return x + 1
}

export async function main(): Promise<i32> {
  const both = await Promise.all([next(1), next(2)])
  console.log(both[0] + both[1])
  return 0
}
