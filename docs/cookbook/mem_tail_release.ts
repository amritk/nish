// A tail call whose arguments are all scalars takes the scope release with it:
// `@nish_arena_release` is emitted after the arguments and before the call, so
// `sum` ends with the call and an optimising build turns the recursion into a
// loop instead of a frame per level.
const sum = (n: number, acc: number): number => {
  if (n === 0) return acc;
  const label = `item ${n}`;
  return sum(n - 1, acc + label.length);
};

// Here the accumulator is arena memory the release would reclaim out from
// under the callee, so this one keeps its release after the call.
const joinTo = (n: number, text: string): number => {
  if (n === 0) return text.length;
  return joinTo(n - 1, text + `${n}`);
};
