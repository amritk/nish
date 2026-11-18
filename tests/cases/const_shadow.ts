// A local shadows a module constant, as it would in TypeScript: the scope
// chain is consulted before the constant table.
const N: i32 = 1;

const inner = (): number => {
  return N;
};

export const test = (): number => {
  const N: i32 = 2;
  return N * 10 + inner();
};
