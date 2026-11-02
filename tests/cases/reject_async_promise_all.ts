// `Promise.all`: a promise is never a value to collect; `awaitAll` from
// `nish:async` awaits several calls together (NL2631).
async function load(x: i32): Promise<i32> {
  return x
}

async function run(): Promise<void> {
  Promise.all([load(1), load(2)])
}

export const main = (): i32 => 0
