// WP6: the depth the scope release ahead of a tail call buys, which no case in
// tests/cases can carry — every program there is also run under Node (WP13),
// and a million levels is past V8's stack whatever the native build does.
//
// `sum` allocates one string per level and answers a tail call whose arguments
// are both scalars, so the release is emitted before the call and the call is
// the last instruction. With the release after it the call is not a tail call
// at all: a million levels is a million frames on an 8 MB stack, and the
// linked binary segfaults instead of printing.
export const sum = (n: number, acc: number): number => {
  if (n === 0) return acc;
  const label = `item ${n}`;
  return sum(n - 1, acc + label.length);
};
