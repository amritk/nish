// biome-ignore-all lint/plugin: the declared shape is what the example measures
// biome-ignore-all lint/suspicious/useAwait: an `async` function with no wait is the shape measured
// Shape: the await is on a value that holds a promise, not on a call.
async function next(x: i32): Promise<i32> {
  return x + 1
}

export async function main(): Promise<i32> {
  const pending = next(1)
  const answer = await pending
  console.log(answer)
  return 0
}
