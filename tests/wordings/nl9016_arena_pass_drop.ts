// NL9016: a local declared outside a loop and given a new allocation on every
// pass drops the value the pass before gave it.
export const lastLine = (rows: i32): i32 => {
  let last = "";
  for (let i = 0; i < rows; i++) {
    last = `row ${i}`;
  }
  return last.length;
};
