// Self-recursive sums with an arena scope that the loop must not take: a
// step hands the next frame a value it allocated, which a release at the end
// of the step would free under it. Each compiles as plain recursion (no
// `rec.head` in acc_arena_ineligible.ll).

// A template as the argument.
const grow = (s: string, n: i32): i32 => {
  if (n <= 0) {
    return s.length
  }
  return 1 + grow(`${s}x`, n - 1)
}

// A concatenation as the argument.
const append = (s: string, n: i32): i32 => {
  if (n <= 0) {
    return s.length
  }
  return n + append(s + "y", n - 1)
}

// A local the step built, passed by name.
const named = (s: string, n: i32): i32 => {
  if (n <= 0) {
    return s.length
  }
  const next = `${n}${s}`
  return 2 + named(next, n - 1)
}

// Reads the arena's bump position: a loop's per-step release would show it a
// different `Arena.used()` from the recursion's, so it keeps its recursion
// (`readsArenaState`) though every argument is held.
const measured = (n: i32): i32 => {
  if (n <= 0) {
    return 0
  }
  const s = `${n}`
  const grew = Arena.used() >= 0 ? 1 : 0
  return s.length + grew + measured(n - 1)
}

export const main = (): i32 => {
  console.log(`${grow("", 5)} ${append("a", 4)} ${named("", 12)} ${measured(12)}`)
  return 0
}
