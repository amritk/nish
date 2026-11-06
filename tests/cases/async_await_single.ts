// WP49: one `await` splits `main` into two states; `answer` awaits nothing, so
// it is a plain function and the await a plain call.
async function answer(x: i32): Promise<i32> {
  return x + 40
}

export async function main(): Promise<i32> {
  const v = await answer(2)
  console.log(v)
  return 0
}
