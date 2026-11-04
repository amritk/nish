// An `await` as an `if` condition: name the answer first (NL2642).
async function load(x: i32): Promise<i32> {
  return x
}

async function run(): Promise<void> {
  if (await load(1) > 0) {
    console.log("yes")
  }
}

export const main = (): i32 => 0
