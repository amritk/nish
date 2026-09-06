// Recursive Fibonacci: the classic call-overhead benchmark (bench/README.md).
// The twins are fib.c and fib.rs; every version prints fib(N) as its checksum.
function fib(n: number): number {
  if (n < 2) {
    return n;
  }
  return fib(n - 1) + fib(n - 2);
}

export function main(): number {
  const N = 40; // bench:n
  console.log(fib(N));
  return 0;
}
