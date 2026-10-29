// Not a link program (no main.ts): tests/run.js's build_id section and
// scripts/build-id-smoke.sh link it to read the NT_GNU_BUILD_ID note.
function fib(n: number): number {
  if (n < 2) return n;
  return fib(n - 1) + fib(n - 2);
}

export function main(): number {
  console.log(`fib(20) = ${fib(20)}`);
  return 0;
}
