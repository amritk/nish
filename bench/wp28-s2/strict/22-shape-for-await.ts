// biome-ignore-all lint/plugin: the declared shape is what the example measures
// Shape: a `for await` loop.
export async function main(): Promise<i32> {
  const numbers: i32[] = [1, 2]
  let total = 0
  for await (const n of numbers) {
    total += n
  }
  console.log(total)
  return 0
}
