// Panic sites: a call reaches the first site its callee reaches at run time,
// and an operation checks its operands only once they are evaluated. So an
// overflow or a division whose operand calls `pick` reaches `pick`'s index
// check first, on either side and in `op=`, and `"via"` stays `index`;
// an overflow inside the arguments is evaluated before the call, and is the
// one reached. The operands come from the argument count, so no caller
// proves them.
const pick = (xs: i32[], i: i32): i32 => xs[i];

const after = (xs: i32[], i: i32): i32 => pick(xs, i) + 1;

const before = (xs: i32[], i: i32): i32 => 1 + pick(xs, i);

const compound = (xs: i32[], i: i32): i32 => {
  let x: i32 = i;
  x += pick(xs, i);
  return x;
};

const divided = (xs: i32[], i: i32): i32 => 100 / pick(xs, i);

const argument = (xs: i32[], i: i32): i32 => pick(xs, i - 1);

export const main = (): number => {
  const k: i32 = process.argv.length;
  const xs: i32[] = [4, 5];
  console.log(after(xs, k));
  console.log(before(xs, k));
  console.log(compound(xs, k));
  console.log(divided(xs, k));
  console.log(argument(xs, k));
  return 0;
};
