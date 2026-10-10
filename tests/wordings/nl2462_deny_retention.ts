// NL2462: under --deny-retention, an arena-retention warning in the program's
// own code is an error that keeps the warning's code and text.
export const lastLine = (rows: i32): i32 => {
  let last = "";
  for (let i = 0; i < rows; i++) {
    last = `row ${i}`;
  }
  return last.length;
};
