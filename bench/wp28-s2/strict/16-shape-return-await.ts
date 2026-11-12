// biome-ignore-all lint/plugin: the declared shape is what the example measures
// biome-ignore-all lint/suspicious/useAwait: an `async` function with no wait is the shape measured
// Shape: `return await f()`, the commonest spelling of a forwarded call.
async function next(x: i32): Promise<i32> {
  return x + 1
}

async function forward(x: i32): Promise<i32> {
  return await next(x)
}

export async function main(): Promise<i32> {
  const answer = await forward(1)
  console.log(answer)
  return 0
}
