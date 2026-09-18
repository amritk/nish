// WP6: what the `tail` marker buys on its own, with no optimiser and no arena
// scope in sight. `odds` allocates nothing, so it has no scope and the release
// §2b moves is not even in the picture; and the `args` file builds this at
// `--profile debug`, which is clang's `-O0`, so no pass runs to notice that the
// call is in tail position. The marker is the whole of what makes a million
// levels fit: it says the callee cannot reach this frame, so the frame is
// reused rather than stacked. Strip the `tail` out of the emitted IR by hand
// and the binary segfaults instead of printing 500000.
export const odds = (n: number, acc: number): number => {
  if (n === 0) return acc;
  return odds(n - 1, acc + (n & 1));
};
