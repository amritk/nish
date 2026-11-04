// `await` of a call to a function that is not `async` (NL2644).
function plain(x: i32): i32 {
  return x
}

async function run(): Promise<void> {
  const a = await plain(1)
}

export const main = (): i32 => 0
