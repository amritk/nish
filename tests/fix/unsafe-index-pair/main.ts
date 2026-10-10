// #461: rewriting one access may not un-prove its neighbour. `at` holds two
// elements, so `at[0]` and `at[1]` are proven and only `a[...]` and `b[...]`
// are sites. `uncheckedGet` is a load to the bounds analysis, not a call that
// may resize `at`, so `at[1]` stays proven after `a[at[0]]` is rewritten, and
// both sites and the import land in one round: `rewrites` counts it and the
// round that fixes `seed.ts`.
export const pair = (a: i32[], b: i32[]): i32 => {
  const at: i32[] = [2, 0]
  return a[at[0]] + b[at[1]]
}
