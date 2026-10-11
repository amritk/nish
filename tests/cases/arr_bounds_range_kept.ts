// Ranges that are not a proof. An unsigned sum wraps by definition, so its
// range is not the value's; an array whose length is only known at run time
// has no top to compare with. Each function keeps its one bounds check.
const unsignedSum = (xs: i32[]): i32 => {
  const ys = new Array<i32>(16);
  let total = 0;
  for (let r: u32 = 0; r < 8; r++) {
    for (let c: u32 = 0; c < 8; c++) {
      total = total + ys[r + c];
    }
  }
  return total + xs.length;
};

const unknownLength = (xs: i32[]): i32 => {
  let total = 0;
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      total = total + xs[r * 4 + c];
    }
  }
  return total;
};

export const main = (): number => {
  const xs = new Array<i32>(16);
  const sized = new Array<i32>(parseInt("16"));
  console.log(`${unsignedSum(xs)}`);
  console.log(`${unknownLength(sized)}`);
  return 0;
};
