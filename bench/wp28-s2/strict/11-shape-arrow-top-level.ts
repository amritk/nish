// biome-ignore-all lint/plugin: the declared shape is what the example measures
// biome-ignore-all lint/suspicious/useAwait: an `async` function with no wait is the shape measured
// Shape: a top-level `async` arrow function bound to a const.
const next = async (x: i32): Promise<i32> => x + 1

export async function main(): Promise<i32> {
  const answer = await next(1)
  console.log(answer)
  return 0
}
