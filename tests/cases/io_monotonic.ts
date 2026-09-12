// `monotonicNanos`: the monotonic clock in nanoseconds as an i64. A golden
// cannot hold a timestamp, so this pins the two properties every run has —
// the clock does not go backwards, and it does advance.
//
// The bounded spin is what makes "it advances" a test rather than a hope: a
// `readnone` clock would let LLVM fold the two reads into one and the difference
// would be exactly zero forever, and a fixed amount of work between them would
// only be a bet on the resolution of whatever machine is running the suite.
export const main = (): number => {
  const first = monotonicNanos();
  let later = monotonicNanos();
  let spins: i32 = 0;
  while (later === first && spins < 10000000) {
    later = monotonicNanos();
    spins += 1;
  }
  console.log(`monotonic: ${later >= first}`);
  console.log(`advances: ${later > first}`);
  return 0;
};
