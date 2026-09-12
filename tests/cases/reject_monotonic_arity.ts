// The clock takes no arguments — there is no clock to choose between, and a
// resolution argument would be a second contract to keep.
function f(): i64 {
  return monotonicNanos(1);
}
