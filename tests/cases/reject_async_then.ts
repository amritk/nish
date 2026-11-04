// `.then` on a call to an async function: `await` it instead (NL2650).
async function load(x: i32): Promise<i32> {
  return x
}

async function run(): Promise<void> {
  load(1).then(1)
}

export const main = (): i32 => 0
