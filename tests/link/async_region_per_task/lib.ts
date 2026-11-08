// The build of a C probe against the runtime, its executor included, shared by
// the async link programs that drive runtime/runtime-async.c's entry points
// directly. Answers the probe's exit status, or 1 after a line naming the
// step that failed, so a missing tool reads as itself.
export const runProbe = (name: string): number => {
  const work = `build/${name}`
  mkdirSync("build")
  mkdirSync(work)
  const exe = `${work}/probe`
  const built = spawnSyncTo(
    ["bash", "scripts/build.sh", `tests/link/${name}/probe.c`, "runtime/runtime.c", "runtime/runtime-async.c", "-o", exe],
    `${work}/build.out`,
    `${work}/build.err`
  )
  if (built !== 0) {
    console.log(`build failed: ${built}`)
    return 1
  }
  return spawnSync([exe])
}
