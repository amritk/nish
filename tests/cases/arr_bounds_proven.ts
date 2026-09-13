// WP15 §2.1/§2.2: an index the checker proves in range emits no bounds check.
// Four routes into the proof, one per function, and the golden is the whole
// assertion: not one `bounds.fail` block, not one `nish_panic_index`, and not
// one length load that only the compare needed.
const counted = (xs: i32[]): i32 => {
  let total = 0;
  for (let i = 0; i < xs.length; i = i + 1) {
    total = total + xs[i];
  }
  return total;
};

// The hoist everybody is told to write: `n <= xs.length` survives the loop and
// `i < n` is what proves the access.
const hoisted = (xs: i32[]): i32 => {
  const n = xs.length;
  let total = 0;
  let i = 0;
  while (i < n) {
    total = total + xs[i];
    i = i + 1;
  }
  return total;
};

// §2.2's length guard: the test narrows the array for the whole region it
// reaches, so both constant indices are proven by it.
const magic = (data: i32[]): i32 => {
  if (data.length >= 4) {
    return data[0] + data[3];
  }
  return 0;
};

// The early exit states the negation for the rest of the block, which is how a
// scanner is written.
const afterExit = (xs: i32[], i: i32): i32 => {
  if (i < 0 || i >= xs.length) {
    return -1;
  }
  return xs[i];
};

export const test = (): number => {
  const xs = [1, 2, 3];
  return counted(xs) + hoisted(xs) + magic([4, 5, 6, 7]) + afterExit(xs, 1);
};
