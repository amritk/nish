// `spawnPiped` grows its `stdout` and `stderr` in the arena with
// `nish_array_grow`, as `push` grows its receiver, so a function handed those
// arrays by its caller must not get an automatic arena scope (WP6): the
// scope's `nish_arena_release` would rewind past the bytes the caller is about
// to read, and the next allocation would overwrite them. The template literal
// gives the function an allocation that does flow locally, and every other
// array is the caller's, so there is a scope to get wrong; the case pins both halves, no scope in the IR golden and
// the captured bytes still whole after 4 KiB of allocation on top.
const capture = (argv: string[], stdin: readonly u8[], out: u8[], err: u8[]): i32 => {
  const label = `run ${argv[0]}`;
  console.log(label);
  return spawnPiped(argv, stdin, out, err);
};

export const main = (): number => {
  const out: u8[] = [];
  const err: u8[] = [];
  const none: u8[] = [];
  const status = capture(["sh", "-c", "printf captured-output; printf oops >&2"], none, out, err);
  const filler: u8[] = [];
  for (let i = 0; i < 4096; i++) {
    filler.push(90);
  }
  console.log(`filled ${filler.length}`);
  console.log(`${status}: ${String.fromBytes(out, 0, out.length)} / ${String.fromBytes(err, 0, err.length)}`);
  return 0;
};
