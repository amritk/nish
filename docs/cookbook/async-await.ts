// biome-ignore lint/suspicious/useAwait: a leaf awaits nothing, so it lowers to a plain call
const inc = async (x: i32): Promise<i32> => x + 1

const step = async (x: i32): Promise<i32> => {
  const a = await inc(x)
  return a * 2
}

export const main = async (): Promise<i32> => {
  const n = await step(1)
  console.log(n)
  return 0
}
