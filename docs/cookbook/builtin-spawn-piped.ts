export const main = (): number => {
  const secret: u8[] = []
  const word = "hunter2"
  for (let i = 0; i < word.length; i++) {
    secret.push(toU8(word.charCodeAt(i)))
  }
  const out: u8[] = []
  const err: u8[] = []
  const status = spawnPiped(["sha256sum"], secret, out, err)
  console.log(`status ${status}, ${out.length} bytes out, ${err.length} bytes err`)
  return 0
}
