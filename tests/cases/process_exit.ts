// `process.exit(code);` is a terminator: `finish` returns a number but ends
// with the exit call instead of a `return`, and the emitter closes the block
// with `unreachable` after the `noreturn` call to nish_exit. Both functions
// lose `willreturn`. The harness requires exit status 0, so `finish(0)`.
function finish(code: number): number {
  console.log("exiting");
  process.exit(code);
}

export function main(): number {
  finish(0);
  console.log("not printed");
  return 1;
}
