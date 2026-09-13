// A hole has no value, and there is no `undefined` to put in its slot.
export const xs = (): number => {
  const a: number[] = [1, , 3];
  return a.length;
};
