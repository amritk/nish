// biome-ignore-all lint/plugin: the declared shape is what the example measures
// biome-ignore-all lint/suspicious/useAwait: an `async` function with no wait is the shape measured
// Shape: the await stands inside a larger expression, not at the top of its
// statement.
async function next(x: i32): Promise<i32> {
  return x + 1
}

export async function main(): Promise<i32> {
  const answer = (await next(1)) + (await next(2))
  console.log(answer)
  return 0
}
