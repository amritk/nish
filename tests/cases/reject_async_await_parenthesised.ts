// `await(...)` is a call to a function named `await`: the operator is
// written with no parentheses around its call (NL2633).
async function load(x: i32): Promise<i32> {
  return x
}

async function run(): Promise<void> {
  await(load(1))
}

export const main = (): i32 => 0
