// A tail call whose arguments are all scalars is the last thing its function
// does, and carries `tail` to say so: the callee is handed no pointer, so it
// can reach nothing of this frame and the frame may be popped before the jump.
// The scope release has to move for the same reason — left between the call
// and the `ret` it would be work after the call — so `@nish_arena_release` is
// emitted after the arguments and before the call instead.
const sum = (n: number, acc: number): number => {
  if (n === 0) return acc;
  const label = `item ${n}`;
  return sum(n - 1, acc + label.length);
};

// No temporaries, so no scope and nothing to move: here the marker is the
// whole of it, and it is what makes a deep recursion fit at `--profile debug`,
// where nothing rewrites the recursion into a loop.
const steps = (n: number, acc: number): number => {
  if (n === 0) return acc;
  return steps(n - 1, acc + 1);
};

// Here the accumulator is arena memory the release would reclaim out from
// under the callee — and a pointer into this frame is exactly what the marker
// would be denying — so this one keeps its release after the call and carries
// no `tail`.
const joinTo = (n: number, text: string): number => {
  if (n === 0) return text.length;
  return joinTo(n - 1, text + `${n}`);
};
