// INT_MIN / -1 and INT_MIN % -1: JavaScript gives -2147483648 and 0 (after | 0);
// LLVM's sdiv/srem are undefined for this input. The divisor is derived from
// Math.random() so LLVM cannot fold it: x86-64 `idiv` then raises SIGFPE.
// Listed in known-failures.txt; see docs/wp13-differential.md.
function div(a: number, b: number): number {
  return a / b;
}

function rem(a: number, b: number): number {
  return a % b;
}

export function main(): number {
  const min = -2147483647 - 1;
  const d = toI32(Math.random()) - 1;
  console.log(`d = ${d}`);
  console.log(div(min, d));
  console.log(rem(min, d));
  return 0;
}
