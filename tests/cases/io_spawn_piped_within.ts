// `spawnPipedWithin`: `spawnPiped` with a deadline. A run still going when
// the deadline passes answers -3, its child killed and reaped, and the bytes
// read before then stay in the arrays. Each timed-out run here would take
// 1000 seconds without the deadline, and the bound it is held to is a
// generous 20 seconds, so a loaded machine cannot turn a pass into a failure.
// The children `exec` their `sleep`, so the pid the deadline kills is the
// sleeper itself.

// Whether the run since `start` took under 20 seconds.
const prompt = (start: i64): boolean => monotonicNanos() - start < 20000000000;

export const main = (): number => {
  const none: u8[] = [];
  const out: u8[] = [];
  const err: u8[] = [];

  // A child that never ends: -3 at the deadline, not 1000 seconds later.
  let start = monotonicNanos();
  const slept = spawnPipedWithin(["sh", "-c", "exec sleep 1000"], none, out, err, 200);
  console.log(`sleep: ${slept} ${prompt(start)}`);

  // What it printed before the deadline is kept, each stream in its array.
  // The deadline is 2 seconds so a loaded machine still runs both printfs.
  start = monotonicNanos();
  const partial = spawnPipedWithin(["sh", "-c", "printf out; printf err >&2; exec sleep 1000"], none, out, err, 2000);
  console.log(
    `partial: ${partial} ${String.fromBytes(out, 0, out.length)} ${String.fromBytes(err, 0, err.length)} ${prompt(start)}`,
  );

  // A child that ends in time answers its own status with its whole output.
  const done: u8[] = [];
  const quiet: u8[] = [];
  console.log(`exit 0: ${spawnPipedWithin(["sh", "-c", "printf done"], none, done, quiet, 20000)}`);
  console.log(`exit 3: ${spawnPipedWithin(["sh", "-c", "printf more; exit 3"], none, done, quiet, 20000)}`);
  console.log(`output: ${String.fromBytes(done, 0, done.length)} ${quiet.length}`);

  // The 16 MiB cap still answers -2 when it comes first.
  const flood: u8[] = [];
  console.log(`flood: ${spawnPipedWithin(["yes"], none, flood, err, 20000)} ${flood.length}`);

  // More stdin than a pipe holds, to a child that never reads it: the
  // writing waits on the poll loop, which the deadline ends.
  const big: u8[] = [];
  for (let i = 0; i < 256 * 1024; i++) {
    big.push(toU8(i));
  }
  start = monotonicNanos();
  const unread = spawnPipedWithin(["sh", "-c", "exec sleep 1000"], big, out, err, 200);
  console.log(`stdin unread: ${unread} ${prompt(start)}`);
  // One that ignores its stdin and exits answers its status, not -3.
  console.log(`stdin ignored: ${spawnPipedWithin(["sh", "-c", "exit 5"], big, out, err, 20000)}`);

  // A child that closes both its output streams leaves the poll loop nothing
  // to wait on, and the final wait is bounded by the same deadline.
  start = monotonicNanos();
  const closed = spawnPipedWithin(["sh", "-c", "exec >&- 2>&-; exec sleep 1000"], none, out, err, 200);
  console.log(`closed streams: ${closed} ${prompt(start)}`);

  // A deadline of zero has already passed.
  console.log(`zero: ${spawnPipedWithin(["sh", "-c", "exec sleep 1000"], none, out, err, 0)}`);

  // The deadline covers the whole run, the child's children included: one
  // left behind holding the output pipe turns the parent's exit 0 into -3.
  console.log(`grandchild: ${spawnPipedWithin(["sh", "-c", "sleep 5 & exit 0"], none, out, err, 200)}`);

  // A negative deadline is none: the run is `spawnPiped`'s.
  const plain: u8[] = [];
  console.log(`no deadline: ${spawnPipedWithin(["sh", "-c", "printf plain; exit 4"], none, plain, err, -1)} ${String.fromBytes(plain, 0, plain.length)}`);

  // A program that is not there is -1, as for `spawnPiped`.
  console.log(`missing: ${spawnPipedWithin(["nish-no-such-program"], none, out, err, 1000)}`);
  return 0;
};
