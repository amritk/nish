// `spawnPiped`: a child with its stdin fed from memory and its stdout and
// stderr captured into arrays, so a secret reaches it on a pipe and never in
// its argument vector, its environment or a file.

const same = (a: readonly u8[], b: readonly u8[]): boolean => {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length && i < b.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
};

// Whether `needle` occurs anywhere in `hay`.
const contains = (hay: readonly u8[], needle: readonly u8[]): boolean => {
  for (let i = 0; i + needle.length <= hay.length; i++) {
    let j = 0;
    while (j < needle.length && hay[i + j] === needle[j]) {
      j++;
    }
    if (j === needle.length) {
      return true;
    }
  }
  return false;
};

export const main = (): number => {
  // Every byte value through `cat` and back, unchanged.
  const all: u8[] = [];
  for (let i = 0; i < 256; i++) {
    all.push(toU8(i));
  }
  const echoed: u8[] = [];
  const quiet: u8[] = [];
  const catStatus = spawnPiped(["cat"], all, echoed, quiet);
  console.log(`cat: ${catStatus} ${echoed.length} ${same(all, echoed)} ${quiet.length}`);

  // More than a pipe holds in both directions: the poll loop drains stdout
  // while it is still writing stdin, or the two would wait on each other.
  const big: u8[] = [];
  for (let i = 0; i < 1536 * 1024; i++) {
    big.push(toU8(i * 7 + (i >> 9)));
  }
  const back: u8[] = [];
  const bigStatus = spawnPiped(["/bin/cat"], big, back, quiet);
  console.log(`big: ${bigStatus} ${back.length} ${same(big, back)}`);

  // One array as both stdin and stdout: the output lands after the input,
  // which is still what is sent after the array grows and moves.
  const twice: u8[] = [];
  for (let i = 0; i < 100000; i++) {
    twice.push(toU8(i));
  }
  spawnPiped(["cat"], twice, twice, quiet);
  let halves = twice.length === 200000;
  for (let i = 0; halves && i < 100000; i++) {
    halves = twice[i] === twice[i + 100000];
  }
  console.log(`twice: ${twice.length} ${halves}`);

  // The two streams apart, and the exit status.
  const none: u8[] = [];
  const out: u8[] = [];
  const err: u8[] = [];
  const split = spawnPiped(["sh", "-c", "printf out; printf err >&2; exit 3"], none, out, err);
  console.log(`split: ${split} ${String.fromBytes(out, 0, out.length)} ${String.fromBytes(err, 0, err.length)}`);

  // Appended, never replaced: a second run lands after the first's bytes.
  spawnPiped(["/bin/sh", "-c", "printf more"], none, out, err);
  console.log(`appended: ${String.fromBytes(out, 0, out.length)}`);

  // A program that is not there is -1, by path search and by absolute path.
  console.log(`missing: ${spawnPiped(["nish-no-such-program"], all, out, err)}`);
  console.log(`missing path: ${spawnPiped(["/nonexistent/nish-prog"], all, out, err)}`);

  // A child that exits without reading its stdin: the write fails with
  // EPIPE, which is not fatal to this program, and the status is the child's.
  console.log(`unread: ${spawnPiped(["true"], big, out, err)}`);

  // The child starts with SIGPIPE as this program had it, neither ignored
  // nor blocked, so one that writes to a reader that has gone dies of it.
  console.log(`child sigpipe: ${spawnPiped(["sh", "-c", "kill -PIPE $$; echo alive"], none, out, err)}`);

  // A child that never stops printing is killed at 16 MiB: -2, and the array
  // keeps what was read up to the cap.
  const flood: u8[] = [];
  const floodStatus = spawnPiped(["yes"], none, flood, err);
  console.log(`flood: ${floodStatus} ${flood.length}`);

  // The pipes are close-on-exec: a child, started after every call above,
  // holds its three standard streams and no other descriptor of this process.
  const fds: u8[] = [];
  const probe = "for f in 3 4 5 6 7 8 9; do if ( : <&$f ) 2>/dev/null; then printf '%s ' $f; fi; done";
  spawnPiped(["sh", "-c", probe], none, fds, err);
  console.log(`inherited: [${String.fromBytes(fds, 0, fds.length)}]`);

  // The secret travels on stdin only: neither the child's command line nor
  // its environment carries it.
  const secret: u8[] = [];
  const word = "hunter2-secret";
  for (let i = 0; i < word.length; i++) {
    secret.push(toU8(word.charCodeAt(i)));
  }
  const seen: u8[] = [];
  spawnPiped(["cat", "/proc/self/cmdline"], secret, seen, err);
  spawnPiped(["env"], secret, seen, err);
  console.log(`secret visible: ${contains(seen, secret)}`);
  return 0;
};
