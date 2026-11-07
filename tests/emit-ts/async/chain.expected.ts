// An async chain is written as the TypeScript it is: `async`, `Promise<T>` and
// each `await` pass through, and the launcher awaits the async `main`.
import { checkedMul, checkedAdd } from "nish/runtime"
import type { i32 } from "nish/runtime"
async function double(x: i32): Promise<i32> {
  return checkedMul(x, 2)
}

async function twice(x: i32): Promise<i32> {
  const a = await double(x)
  const b = await double(a)
  return checkedAdd(a, b)
}

export async function main(): Promise<void> {
  const t = await twice(3)
  console.log(t)
}
