// The local form, which predates property paths: `xs[i] = (i = 0)` was
// proven against the new `i` and stored through the old one. Run by
// tests/run.js: exit 1 with "index out of range: 1000000 >= 3".
const poke = (xs: i32[], start: i32): i32 => {
  let i = start;
  if (xs.length >= 1) {
    xs[i] = (i = 0);
  }
  return i;
};

export const main = (): number => {
  console.log(`${poke([1, 2, 3], 1000000)}`);
  return 0;
};
