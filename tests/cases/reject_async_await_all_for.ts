// `awaitAll`, like `await`, stands at the top of a statement: a `for`
// initializer is not one.
import { awaitAll } from "nish:async"

async function f(x: number): Promise<number> {
  return x
}

async function run(): Promise<void> {
  for (const [a, b] = await awaitAll(f(1), f(2)); a < b; ) {
    return
  }
}

function main(): void {}
