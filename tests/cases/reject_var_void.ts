// A variable of type void would name a value that does not exist.
const nothing = (): void => {};

export const run = (): number => {
  const x = nothing();
  return 0;
};
