// biome-ignore-all lint/plugin: the declared shape is what the example measures
// biome-ignore-all lint/suspicious/useAwait: an `async` function with no wait is the shape measured
// Class contagion: every await is a direct call to another `async` function of
// the program. `outer` and `middle` are coloured only because `inner` is.
async function inner(x: i32): Promise<i32> {
  return x + 1
}

async function middle(x: i32): Promise<i32> {
  const y = await inner(x)
  return y * 2
}

async function outer(x: i32): Promise<i32> {
  const y = await middle(x)
  return y + 1
}

export async function main(): Promise<i32> {
  const answer = await outer(1)
  console.log(answer)
  return 0
}
