// The helper and the function it hands its array to live here, in another
// module from the caller in `main.ts`.
const fill = (ys: i32[]): void => {
  for (let i = 0; i < ys.length; i++) {
    ys[i] = i + 1;
  }
};

export const filledFour = (): i32[] => {
  const arr = new Array<i32>(4);
  fill(arr);
  return arr;
};
