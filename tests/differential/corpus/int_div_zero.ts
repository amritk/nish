// Integer division by zero: JavaScript gives Infinity | 0 === 0 and NaN | 0 === 0;
// LLVM's sdiv/srem by zero are undefined. The zero comes from Math.random() so
// LLVM cannot fold it: x86-64 `idiv` then raises SIGFPE.
// Listed in known-failures.txt; see docs/wp13-differential.md.
function div(a: number, b: number): number {
  return a / b;
}

function rem(a: number, b: number): number {
  return a % b;
}

export function main(): number {
  const z = toI32(Math.random());
  console.log(`z = ${z}`);
  console.log(div(7, z));
  console.log(rem(7, z));
  return 0;
}
