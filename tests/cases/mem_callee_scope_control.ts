// A negative of the callee scope: a function that manages the arena itself.
// `sumRows` releases each row it builds with `Arena.mark()` / `Arena.release(m)`,
// so the compiler's own mark would be one the program can invalidate, and it
// gets no scope; `twice` calls it, so neither does `twice`, although its other
// callee leaves a row behind. `sumRows` loops over an allocating call and is
// not warned about either: its author is already managing that memory.
const makeRow = (n: i32): i32[] => {
  const row: i32[] = [];
  for (let i = 0; i < n; i++) {
    row.push(i);
  }
  return row;
};

const sumRows = (n: i32): i32 => {
  let total = 0;
  for (let i = 0; i < n; i++) {
    const m = Arena.mark();
    total += makeRow(i).length;
    Arena.release(m);
  }
  return total;
};

const twice = (n: i32): i32 => sumRows(n) + makeRow(n).length;

export const main = (): number => {
  console.log(twice(10));
  return 0;
};
