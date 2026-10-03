// A compound element assignment evaluates its right side before it takes the
// slot's address for the store, as JavaScript does: `xs[0] += grow(xs)` reads
// `xs[0]`, runs `grow`, which pushes until the elements move to a new block,
// and stores into the block `xs` has now. It stored into the old one, so
// `xs[0]` read back 1 where JavaScript gives 6. `zs[2] += shrink(zs)` checks
// the index again against the length `shrink` left, and panics where it
// stored past the end; `cg_sec_compound_element_order.c` runs it in a child
// process. docs/security/codegen.md, CG-10.
const grow = (xs: i32[]): i32 => {
  let i = 0;
  while (i < 8) {
    xs.push(i);
    i = i + 1;
  }
  return 5;
};

const shrink = (zs: i32[]): i32 => {
  zs.pop();
  zs.pop();
  return 10;
};

export const shrinkPastEnd = (): i32 => {
  const zs: i32[] = [1, 2, 3];
  zs[2] += shrink(zs);
  return zs.length;
};

export const test = (): i32 => {
  const xs: i32[] = [1];
  xs[0] += grow(xs);
  const ys: i32[] = [3];
  ys[0] *= grow(ys);
  const bits: i32[] = [1];
  bits[0] |= grow(bits);
  return xs[0] * 10000 + ys[0] * 100 + bits[0];
};
