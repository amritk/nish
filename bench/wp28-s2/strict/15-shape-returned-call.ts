// biome-ignore-all lint/plugin: the declared shape is what the example measures
// biome-ignore-all lint/suspicious/useAwait: an `async` function with no wait is the shape measured
// Shape: a call to an `async` function is returned without an await.
async function next(x: i32): Promise<i32> {
  return x + 1
}

async function forward(x: i32): Promise<i32> {
  return next(x)
}

export async function main(): Promise<i32> {
  const answer = await forward(1)
  console.log(answer)
  return 0
}
