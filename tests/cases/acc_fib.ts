// A self-recursive checked sum: every recursive return of `fib` is
// `X + fib(...)`, so it is emitted as one loop whose overflow check is
// deferred to the base case (src/emit-accumulate.ts). `fib(n - 1)` stays a
// call; `fib(n - 2)` becomes the back edge.
const fib = (n: i32): i32 => {
  if (n < 2) {
    return n
  }
  return fib(n - 1) + fib(n - 2)
}

export const main = (): i32 => {
  console.log(`${fib(0)} ${fib(1)} ${fib(2)} ${fib(10)} ${fib(25)}`)
  return 0
}
