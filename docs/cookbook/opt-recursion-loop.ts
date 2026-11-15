const fib = (n: i32): i32 => {
  if (n < 2) {
    return n
  }
  return fib(n - 1) + fib(n - 2)
}

export const test = (): i32 => fib(30)
