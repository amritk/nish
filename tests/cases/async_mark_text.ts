// WP49: the frame sizes are placeholders in the module's text until every
// module is emitted, so a string of the program that looks like one must come
// through as written, and the program that holds it must still compile.
async function answer(x: i32): Promise<i32> {
  return x + 40
}

async function two(): Promise<i32> {
  const a = await answer(1)
  const b = await answer(2)
  return a + b
}

export async function main(): Promise<i32> {
  console.log("@@async.bytes:9@@ x")
  console.log("@@async.kids:0@@")
  console.log("see @@async. here")
  const raw = "\x01async.kids:0\x01"
  console.log(raw.length)
  const v = await two()
  console.log(v)
  return 0
}
