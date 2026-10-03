// A `using a = arena()` block may not hand what it allocated to a callee that
// keeps it: `remember` stores its argument into `b`, which outlives the block.
class Box {
  label: string = "";
}

const remember = (b: Box, s: string): void => {
  b.label = s;
};

export const main = (): i32 => {
  const b = new Box();
  {
    using a = arena();
    remember(b, `box ${b.label.length}`);
  }
  console.log(b.label);
  return 0;
};
