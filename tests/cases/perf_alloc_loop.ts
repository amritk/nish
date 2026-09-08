// WP15 §8: a `new Array<T>(n)` whose length is not a literal can never be an
// entry-block alloca (docs/wp6-memory.md §1), so a loop bumps one out of the
// arena every pass. Nothing here keeps it past the iteration, so the compiler
// names the hoist.
export function test(): number {
  const width = 3;
  let total = 0;
  let i = 0;
  while (i < 4) {
    const row = new Array<i32>(width + i);
    row[0] = i;
    row[1] = i * 2;
    total = total + row[0] + row[1] + row.length;
    i = i + 1;
  }
  return total;
}
