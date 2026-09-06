// Recursive Fibonacci: the classic call-overhead benchmark. Compare with fib.c.
function fib(n: number): number {
  if (n < 2) {
    return n;
  }
  return fib(n - 1) + fib(n - 2);
}

function test(): number {
  return fib(35);
}
