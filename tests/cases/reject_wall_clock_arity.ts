// The wall clock takes no arguments, as `monotonicNanos` takes none: there is
// one clock to read.
const f = (): i64 => {
  return wallClockNanos(1);
};
