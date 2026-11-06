// WP49: a function that awaits suspends, so its resume function loses
// `willreturn` and the frame it writes is not `readonly`; `leaf` awaits
// nothing and keeps every attribute a plain function has.
async function leaf(x: i32): Promise<i32> {
  return x + 1
}

async function waits(x: i32): Promise<i32> {
  const y = await leaf(x)
  return y * 2
}

export async function main(): Promise<i32> {
  const v = await waits(4)
  console.log(v)
  return 0
}
