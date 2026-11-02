// Two async functions that await each other: a cycle through `await`
// (NL2630).
async function ping(n: i32): Promise<void> {
  await pong(n)
}

async function pong(n: i32): Promise<void> {
  await ping(n)
}

export const main = (): i32 => 0
