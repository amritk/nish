// A `--sandbox` program granted process.spawn and not fs.write: tests/run.js
// runs `<exe> <program> <file>`, and the child's redirect to <file> is opened
// in the child, under the inherited Landlock domain, so it is refused there.
export const main = (): number => {
  const args = process.argv
  console.log(`status ${spawnSyncTo([args[1]], args[2], "")}`)
  return 0
}
