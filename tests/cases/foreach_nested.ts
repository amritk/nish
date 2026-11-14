// A `forEach` inside the callback of another `forEach` on the same receiver.
// The inner call goes through a top-level function, since an arrow inside
// another arrow reads only its own parameters. Each `Map` walk opens and closes
// its own count of live walks, so the nested ones finish and a `delete` after
// them still compacts the table. All agree with Node.

const row = (xs: i32[], x: i32): void => {
  xs.forEach((y) => console.log(`${x}*${y}`))
}

const pairs = (m: Map<string, i32>, k: string): void => {
  m.forEach((v, j) => console.log(`${k}${j}=${v}`))
}

export const main = (): void => {
  const xs: i32[] = [1, 2]
  xs.forEach((x) => row(xs, x))

  const m = new Map<string, i32>()
  m.set("a", 1)
  m.set("b", 2)
  m.forEach((_v, k) => pairs(m, k))
  m.delete("a")
  m.set("c", 3)
  m.forEach((v, k) => console.log(`${k}=${v}`))
  console.log(`${m.size}`)
}
