// `spawnSync` (WP14 D4): run argv[0] through PATH, wait, and answer the exit
// status — 128 + n for a signal (the shell's convention), -1 when the program
// could not be started at all and for an empty vector, which has no argv[0] to
// run. `sh -c` is the one program every POSIX host has.
//
// `run` is here for the attributes as much as for the reuse: the runtime keeps
// pointers into the vector it is handed, so `argv` must *not* come out
// `nocapture` or `readonly`, and neither function may be `willreturn`, because
// the child may never exit.
function run(argv: string[]): number {
  return spawnSync(argv);
}

function shell(script: string): number {
  return run(["sh", "-c", script]);
}

export function main(): number {
  console.log(`ok: ${shell("exit 0")}`);
  console.log(`status: ${shell("exit 7")}`);
  console.log(`signal: ${shell("kill -9 $$")}`);
  console.log(`missing: ${run(["amritc-no-such-program"])}`);
  const empty: string[] = [];
  console.log(`empty: ${run(empty)}`);
  return 0;
}
