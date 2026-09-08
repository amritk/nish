// A local shadows a module constant, as it would in TypeScript: the scope
// chain is consulted before the constant table.
const N: i32 = 1;

function inner(): number {
  return N;
}

export function test(): number {
  const N: i32 = 2;
  return N * 10 + inner();
}
