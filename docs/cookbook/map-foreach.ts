// `m.forEach(f)` is `forEachEntry(m, f)` from `std/collections.ts`: the same
// walk as `for (const k of m.keys())`, with the key and value read from the
// entry and handed to `@show` directly, so there is no `get` and no probe.
const show = (v: i32, k: i32): void => {
  console.log(`${k} ${v}`)
}

export const dump = (m: Map<i32, i32>): void => m.forEach(show)
