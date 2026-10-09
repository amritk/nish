// `spell` builds its answer from parts. The strings it pushes are reachable
// only through `parts`, which nothing reads but `push`, `join` and `length`,
// and `join` copies them into a fresh string, so `spell` lets no allocation
// out. Its caller's loop therefore keeps its per-pass release, and the call
// is bracketed by `nish_arena_keep` besides.
const spell = (n: i32): string => {
  const parts: string[] = []
  for (let i = 0; i < n; i++) {
    parts.push(`<${i}>`)
  }
  return parts.join("-")
}

export const measure = (calls: i32): string => {
  let total = 0
  for (let i = 0; i < calls; i++) {
    total = total + spell(1 + (i % 9)).length
  }
  return `${total}`
}
