// A range is compared with the length the index leaves behind. `popOne` takes
// an element off `xs` while the index is computed, so the 16 the array was
// made with no longer holds when the check runs: the check stays, and with
// `r = 15` the access panics with `index out of range: 15 >= 15`.
const popOne = (xs: i32[]): i32 => {
  xs.pop();
  return 0;
};

export const main = (): number => {
  const xs = new Array<i32>(16);
  let total = 0;
  for (let r = 0; r < 16; r++) {
    total = total + xs[r + popOne(xs)];
    xs.push(0);
  }
  console.log(`${total}`);
  return 0;
};
