// A `Promise<T>` parameter: a promise is never a value, so no function takes
// one; an async callee is awaited where it is called (NL2636).
async function load(x: i32): Promise<i32> {
  return x
}

function keep(p: Promise<i32>): i32 {
  return 0
}

export const main = (): i32 => 0
