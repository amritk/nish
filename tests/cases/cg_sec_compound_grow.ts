// `xs[0] += grow(xs)` computed the slot's address before the right side ran,
// so when `grow` pushed until `xs` moved, the sum went into the old block and
// `xs[0]` read back 1 where JavaScript gives 6; `zs[2] += shrink(zs)` stored
// past the new length. The store now re-reads the array's data and checks the
// index again when the right side can move the array, and only then
// (docs/security/codegen.md, CG-10). `cg_sec_compound_grow.c` runs the
// shrinking one in a child, which panics. `grow` is `willreturn`, so the
// second check is what takes the attribute from `test` and `bitwise`, and
// `ys[0] += five()` keeps one check and one address.
const grow = (xs: i32[]): i32 => {
  for (let k = 0; k < 64; k++) {
    xs.push(k);
  }
  return 5;
};

const shrink = (zs: i32[]): i32 => {
  zs.pop();
  return 5;
};

const five = (): i32 => 5;

export const bitwise = (): i32 => {
  const xs: i32[] = [2];
  xs[0] |= grow(xs);
  return xs[0];
};

export const shrunk = (): i32 => {
  const zs: i32[] = [1, 2, 3];
  zs[2] += shrink(zs);
  return zs.length;
};

export const test = (): i32 => {
  const xs: i32[] = [1];
  xs[0] += grow(xs);
  const ys: i32[] = [1];
  ys[0] += five();
  return xs[0] * 10 + ys[0];
};
