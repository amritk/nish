// A helper with two returns gives the shorter of the two lengths: `pick(false)`
// returns two elements, so `xs[5]` keeps its check, and panics.
const pick = (wide: boolean): i32[] => {
  if (wide) {
    const arr = new Array<i32>(6);
    return arr;
  }
  return [1, 2];
};

export const main = (): number => {
  const xs = pick(false);
  console.log(`${xs[1]}`);
  console.log(`${xs[5]}`);
  return 0;
};
