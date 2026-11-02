// An `await` inside a larger expression: it stands at the top of a statement,
// so its answer is named before it is used (NL2624).
async function load(x: i32): Promise<i32> {
  return x
}

async function run(): Promise<void> {
  const a = 1 + await load(1)
}

export const main = (): i32 => 0
