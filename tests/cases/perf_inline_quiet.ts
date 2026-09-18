// WP15 §8: the shapes `--no-strict-exports` must not be reported for, with the
// flag given, so what is being tested is the guards and not the flag. A
// warning that fires where there is nothing to fix is what teaches people to
// ignore a whole diagnostic class.
export const exported = (n: i32): i32 => n * 2 + 1;

const internalHelper = (n: i32): i32 => n + 1;

export const test = (): number => {
  let total = 0;

  // Exported, so the flag changes nothing about it: the C ABI is the point.
  let i = 0;
  while (i < 4) {
    total = total + exported(i);
    i = i + 1;
  }

  // Not exported, but outside any loop: one call is not a cost anybody is
  // paying, and the rewrite would be to stop passing a flag for one call.
  total = total + internalHelper(total);

  // A runtime builtin has no linkage of ours to withdraw.
  const s = `${total}`;
  return total + s.length;
};
