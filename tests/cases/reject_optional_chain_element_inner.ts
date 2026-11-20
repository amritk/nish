// An element read inside a `?.` chain, with a member after it: strict refuses
// it, and `--compat=optional-chaining` admits it, because the bounds check runs
// only when the array is there and the `??` default stands in when it is not.
const second = (xs: string[] | null): number => xs?.[1].length ?? -1;

export const main = (): void => {
  console.log(`${second(["a", "bc"])} ${second(null)}`);
};
