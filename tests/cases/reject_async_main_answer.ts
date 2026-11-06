// WP49: an async `main` is the program's entry, so its answer is the exit code
// as a plain `main`'s is: `Promise<void>` or `Promise<i32>`, never a string.
async function name(): Promise<string> {
  return "nish"
}

export async function main(): Promise<string> {
  const n = await name()
  return n
}
