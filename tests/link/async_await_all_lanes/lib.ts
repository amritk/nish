// The lanes of main.ts's rounds, and the helpers they share: a module of
// their own, so each lane's resume is called across a module boundary.
import { awaitAll, sleep } from "nish:async"

export class Bag {
  label: string
  xs: i32[]
  constructor(label: string, xs: i32[]) {
    this.label = label
    this.xs = xs
  }
}

/** A fresh array of `n` elements counting up from `seed`. */
export function count(n: i32, seed: i32): i32[] {
  const xs = new Array<i32>(n)
  let i = 0
  while (i < xs.length) {
    xs[i] = seed + i
    i = i + 1
  }
  return xs
}

/** How many elements of `xs` are not `seed + i`: 0 for an untouched array. */
export function wrong(xs: i32[], seed: i32): i32 {
  let bad = 0
  let i = 0
  while (i < xs.length) {
    if (xs[i] !== seed + i) {
      bad = bad + 1
    }
    i = i + 1
  }
  return bad
}

/** A string built across two waits, from an array held across both. */
export async function text(n: i32, ms: i32): Promise<string> {
  const xs = count(n, 3)
  await sleep(ms)
  const ys = count(n, 5)
  await sleep(ms)
  return `text ${xs.length} ${wrong(xs, 3) + wrong(ys, 5)}`
}

/** An array answered from the lane's own memory, held across two waits. */
export async function numbers(n: i32, ms: i32): Promise<i32[]> {
  const xs = count(n, 11)
  await sleep(ms)
  const ys = count(n, 13)
  await sleep(ms)
  if (wrong(xs, 11) !== 0) {
    return ys
  }
  return xs
}

/** An object whose fields point at memory the lane allocated while it waited. */
export async function bag(n: i32, ms: i32): Promise<Bag> {
  const xs = count(n, 17)
  await sleep(ms)
  const label = `bag ${xs.length}`
  const ys = count(n, 19)
  await sleep(ms)
  return new Bag(label, wrong(ys, 19) === 0 ? xs : ys)
}

/**
 * A number from an array held across a wait: answering no memory, it gives
 * back everything it allocated as it returns, which is what freed its
 * siblings' memory when every lane shared one arena.
 */
export async function total(n: i32, ms: i32): Promise<i32> {
  const xs = count(n, 29)
  await sleep(ms)
  return wrong(xs, 29)
}

/** A lane that joins two lanes of its own. */
export async function nested(n: i32, ms: i32): Promise<string> {
  const held = count(n, 23)
  const [s, b, t] = await awaitAll(text(n, ms), bag(n, ms + 1), total(n, 0))
  await sleep(ms)
  return `${s} ${b.label} ${wrong(b.xs, 17)} ${wrong(held, 23) + t}`
}
