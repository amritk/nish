// WP49: an async function nothing calls is emitted, internal, as an unused plain
// function is (its frame and resume function with it), and the rest of the
// module is the IR it would be without it: `test` is unchanged and no driver
// is emitted, because nothing spawns or awaits from `main`.
async function never(x: i32): Promise<i32> {
  return x
}

async function alsoNever(x: i32): Promise<i32> {
  const y = await never(x)
  return y + 1
}

export function test(): i32 {
  return 42
}
