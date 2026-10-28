// A negative of the callee scope: a function that manages the arena itself.
// `sumRows` reads the arena's position with `Arena.mark()` around each row it
// builds, a position the compiler's own scope would move under it, so it gets
// no scope; `twice` calls it, so neither does `twice`, although its other
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
    if (Arena.mark() < m) {
      panic("the arena moved back");
    }
  }
  return total;
};

const twice = (n: i32): i32 => sumRows(n) + makeRow(n).length;

export const main = (): number => {
  console.log(twice(10));
  return 0;
};
