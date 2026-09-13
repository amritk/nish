// An element of type void would occupy a slot holding nothing.
const nothing = (): void => {};

export const xs = (): number => {
  const a = [nothing()];
  return a.length;
};
