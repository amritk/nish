// The length is a number: there is no conversion from a string.
export const run = (): number => {
  const a = new Array<number>("4");
  return a.length;
};
