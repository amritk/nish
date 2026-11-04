// A name `awaitAll` declares is a `const` like any other: it may not repeat a
// name already in its scope.
import { awaitAll } from "nish:async"

async function f(x: number): Promise<number> {
  return x
}

async function run(x: number): Promise<void> {
  const [x, b] = await awaitAll(f(1), f(2))
  console.log(b)
}

function main(): void {}
