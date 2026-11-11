// `spawnPipedWithin` is `spawnPiped` with a fifth argument, the deadline in
// milliseconds, passed through as an `i32`. A run still going at the deadline
// answers -3, its child killed and reaped and the bytes read so far kept.
export const start = (argv: string[], stdin: readonly u8[], out: u8[], err: u8[]): i32 =>
  spawnPipedWithin(argv, stdin, out, err, 5000)
