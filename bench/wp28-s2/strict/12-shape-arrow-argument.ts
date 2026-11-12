// biome-ignore-all lint/plugin: the declared shape is what the example measures
// biome-ignore-all lint/suspicious/useAwait: an `async` function with no wait is the shape measured
// Shape: an `async` arrow function written inline as an argument.
async function run(task: () => Promise<i32>): Promise<i32> {
  const answer = await task()
  return answer
}

export async function main(): Promise<i32> {
  const answer = await run(async (): Promise<i32> => 1)
  console.log(answer)
  return 0
}
