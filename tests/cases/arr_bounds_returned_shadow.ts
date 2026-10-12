// A size named in the helper is read as the module's constant only when the
// body declares nothing of that name: here a local `WIDTH` of 2 shadows the
// module's 8, so the helper gives no length. The read keeps its check, and
// panics.
const WIDTH: i32 = 8;

const narrow = (): i32[] => {
  const WIDTH = 2;
  const arr = new Array<i32>(WIDTH);
  return arr;
};

export const main = (): number => {
  const xs = narrow();
  console.log(`${xs[7]}`);
  return 0;
};
