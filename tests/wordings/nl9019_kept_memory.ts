// NL9019: a function a loop runs on every pass keeps an allocation each call
// (a `let` given a second string), and the loop's passes release nothing.
const relabel = (n: i32): i32 => {
  let s = "none";
  if (n > 2) {
    s = `b${n}`;
  }
  return s.length;
};

export const labels = (rows: i32): i32 => {
  const out: string[] = [];
  for (let i = 0; i < rows; i++) {
    out.push(`${relabel(i)}`);
  }
  return out.length;
};
