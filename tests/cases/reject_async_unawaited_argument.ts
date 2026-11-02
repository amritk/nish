// A call to an async function passed as an argument: a promise is never
// passed (NL2627).
async function load(x: i32): Promise<i32> {
  return x
}

async function run(): Promise<void> {
  console.log(load(1))
}

export const main = (): i32 => 0
