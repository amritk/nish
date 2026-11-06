// WP49: a chain of awaits, three frames deep. `step` and `twice` keep their
// locals live across each await in their frames; `main` nests `twice`'s frame,
// which nests `step`'s, so every frame has a size the compiler knows.
async function inc(x: i32): Promise<i32> {
  return x + 1
}

async function step(x: i32): Promise<i32> {
  const a = await inc(x)
  const b = await inc(a)
  return a * b
}

async function twice(x: i32): Promise<i32> {
  const first = await step(x)
  const second = await step(first)
  return first + second
}

export async function main(): Promise<i32> {
  const n = await twice(1)
  console.log(n)
  const m = await twice(n)
  console.log(m)
  return 0
}
