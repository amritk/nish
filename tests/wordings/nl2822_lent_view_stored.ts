// NL2822: a spawned task hands a view `lend` borrows to a callee that stores a pointer into it.
import { lend, spawn } from "nish:async"

class Box {
  items: i32[] = []
}

const refill = (b: Box): void => {
  b.items = [1]
}

async function task(b: Box): Promise<void> {
  refill(lend(b))
}

export async function main(): Promise<i32> {
  spawn(task(new Box()))
  return 0
}
