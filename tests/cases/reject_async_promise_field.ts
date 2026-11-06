// A `Promise<T>` field: a class cannot hold a promise any more than a local
// can (NL2654).
async function load(x: i32): Promise<i32> {
  return x
}

class Pending {
  answer: Promise<i32> = load(1)
}

export const main = (): i32 => 0
