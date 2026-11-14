// Under `--number-mode f64` a recursive sum is over `number`, an `f64`, whose
// `+` has no overflow check to defer: it stays plain recursion (no
// `rec.head` in acc_ineligible_f64.ll).
const fib = (n: number): number => {
  if (n < 2) {
    return n
  }
  return fib(n - 1) + fib(n - 2)
}

export const main = (): void => {
  console.log(fib(20))
}
