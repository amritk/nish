// `awaitAll` outside the declaration that names its answers (NL2647).
import { awaitAll } from "nish:async"

async function load(x: i32): Promise<i32> {
  return x
}

async function run(): Promise<void> {
  awaitAll(load(1), load(2))
}

export const main = (): i32 => 0
