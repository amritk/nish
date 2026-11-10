import { awaitAll, sleep } from "nish:async"

const fill = async (n: i32, ms: i32): Promise<i32> => {
  const xs: i32[] = []
  for (let i = 0; i < n; i++) {
    xs.push(i)
  }
  await sleep(ms)
  return xs.length
}

export const main = async (): Promise<i32> => {
  const [a, b] = await awaitAll(fill(3, 2), fill(4, 1))
  console.log(a + b)
  return 0
}
