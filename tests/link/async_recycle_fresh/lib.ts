// The one task of `main.ts`, in its three roles: as `WRITE` it fills its
// region with nonzero bytes, as `JOIN` it does so through an `awaitAll`, whose
// calls' answers are carved into its chunk, and as `READ` it reads what the
// language promises fresh. It is one async function on purpose: nodes, and the
// regions they keep, are recycled per task kind (runtime/runtime-async.c,
// "Regions"), so only a later spawn of this same function runs on the chunk an
// earlier one wrote.
import { awaitAll, sleep, taskId } from "nish:async"

export const WRITE: i32 = 0
export const JOIN: i32 = 1
export const READ: i32 = 2

export class Seen {
  // The node (the low half of `taskId()`) and its generation (the high half)
  // of the task that last dirtied its region, and how many readers ran on
  // that very node, one generation on.
  node: i64 = 0
  gen: i64 = 0
  sameNode: i32 = 0
  dirty: i32 = 0
  wrote: i32 = 0
  rounds: i32 = 0
}

const ones = async (n: i32): Promise<i32[]> => {
  const a: i32[] = []
  for (let i = 0; i < n; i++) {
    a.push(-1)
  }
  await sleep(0)
  return a
}

const sumOf = (a: i32[]): i32 => {
  let sum = 0
  for (const x of a) {
    sum += x
  }
  return sum
}

const stale = (ints: i32[], floats: f64[], maybe: (string | null)[], n: i32): i32 => {
  let count = 0
  for (let i = 0; i < n; i++) {
    if (ints[i] !== 0 || floats[i] !== 0 || maybe[i] !== null) {
      count += 1
    }
  }
  return count
}

export async function task(seen: Seen, n: i32, role: i32): Promise<void> {
  const id = taskId()
  const node = id & 0xffffffff
  const gen = id >> 32
  if (role === JOIN) {
    const [a, b] = await awaitAll(ones(n), ones(n))
    seen.wrote -= sumOf(a) + sumOf(b)
    seen.node = node
    seen.gen = gen
    return
  }
  if (role === WRITE) {
    const a: i32[] = []
    for (let i = 0; i < n; i++) {
      a.push(-1)
    }
    let s = ""
    for (let i = 0; i < n; i++) {
      s = `${s}z`
    }
    await sleep(0)
    seen.wrote += s.length - sumOf(a)
    seen.node = node
    seen.gen = gen
    return
  }
  if (node === seen.node && gen === seen.gen + 1) {
    seen.sameNode += 1
  }
  const ints = new Array<i32>(n)
  const floats = new Array<f64>(n)
  const maybe = new Array<string | null>(n)
  seen.dirty += stale(ints, floats, maybe, n)
  let s = ""
  for (let i = 0; i < 26; i++) {
    s = `${s}a`
  }
  await sleep(0)
  seen.dirty += stale(ints, floats, maybe, n)
  if (s !== "aaaaaaaaaaaaaaaaaaaaaaaaaa") {
    seen.dirty += 1
  }
  seen.rounds += 1
}
