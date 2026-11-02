// An async function that awaits itself: each awaited frame is nested in its
// caller's, so the nesting would have no end (NL2630).
async function count(n: i32): Promise<i32> {
  if (n === 0) {
    return 0
  }
  const rest = await count(n - 1)
  return rest + 1
}

export const main = (): i32 => 0
