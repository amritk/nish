// --deny-retention, the program it accepts: every loop keeps only numbers
// across passes, so each pass's memory is released (a pass scope, or the
// `using a = arena()` block), and the flag changes no byte of the IR.
const label = (n: i32): string => `item ${n}`;

export const main = (): void => {
  let total = 0;
  let lastIndex = -1;
  for (let i = 0; i < 1000; i++) {
    const s = label(i);
    total = total + s.length;
    lastIndex = i;
  }
  const rows = ["a", "bb", "ccc"];
  let widest = 0;
  for (const row of rows) {
    using a = arena();
    const line = `${row}: ${row.length}`;
    if (line.length > widest) {
      widest = line.length;
    }
  }
  console.log(`${total} ${label(lastIndex)} ${widest}`);
};
