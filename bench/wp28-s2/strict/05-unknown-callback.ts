// biome-ignore-all lint/plugin: the declared shape is what the example measures
// biome-ignore-all lint/suspicious/useAwait: an `async` function with no wait is the shape measured
// Class unknown, its commonest decidable form: the await is on a function
// value the function was handed, so what it waits on is the caller's choice.
async function one(): Promise<i32> {
  return 1
}

async function run(task: () => Promise<i32>): Promise<i32> {
  const answer = await task()
  return answer
}

export async function main(): Promise<i32> {
  const answer = await run(one)
  console.log(answer)
  return 0
}
