// WP49: an async `main` answers its exit code once it has finished; the entry
// runs it to completion on the in-process driver.
async function code(x: i32): Promise<i32> {
  return x - 39
}

async function greet(): Promise<void> {
  console.log("hello")
}

export async function main(): Promise<i32> {
  await greet()
  const c = await code(42)
  console.log(c)
  return c - 3
}
