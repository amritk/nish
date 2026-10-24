// A `--sandbox` program granted everything it does: tests/run.js runs `<exe>
// <dir>` with and without `--sandbox`, with and without `--threads`, and holds
// the four to one stdout.
export const main = (): number => {
  const file = `${process.argv[1]}/granted.txt`
  writeFileSync(file, "written and read back")
  console.log(readFileSync(file))
  console.log(`child ${spawnSync(["true"])}`)
  console.log(`cpus ${availableParallelism() > 0}`)
  return 0
}
