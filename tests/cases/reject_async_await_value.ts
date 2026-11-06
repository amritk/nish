// `await` of something that is not a call: a promise is never a value, so
// there is nothing else to await (NL2643).
async function run(x: i32): Promise<void> {
  await x
}

export const main = (): i32 => 0
