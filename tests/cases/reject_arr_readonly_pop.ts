// `pop` shortens the array, which is a write even though it reads a value out.
const last = (xs: readonly number[]): number => {
  return xs.pop();
};
export const main = (): number => {
  const a: number[] = [1];
  return last(a);
};
