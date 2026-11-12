// biome-ignore-all lint/plugin: the declared shape is what the example measures
// biome-ignore-all lint/suspicious/useAwait: an `async` function with no wait is the shape measured
// Shape: a chained `.then` on an `async` call.
async function next(x: i32): Promise<i32> {
  return x + 1
}

export async function main(): Promise<i32> {
  const answer = await next(1).then((y: i32): i32 => y * 2)
  console.log(answer)
  return 0
}
