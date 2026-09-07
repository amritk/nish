// Two clauses cannot select the same value: LLVM's switch table would hold
// the same constant twice.
const ONE: i32 = 1;

function f(n: number): number {
  switch (n) {
    case 1:
      return 1;
    case ONE:
      return 2;
    default:
      return 0;
  }
}
