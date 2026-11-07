// An async `main` that answers a nonzero code keeps it: the launcher drains
// the spawned task first, so it prints, and then exits with `main`'s 3, as the
// native driver does.
import { spawn } from "nish:async"

async function double(x: i32): Promise<i32> {
  return x * 2
}

async function report(x: i32): Promise<void> {
  const d = await double(x)
  console.log(d)
}

export async function main(): Promise<i32> {
  spawn(report(21))
  return 3
}
