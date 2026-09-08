// `switch` lowers to LLVM's `switch`: one table, one default edge. Empty
// clauses stack, so `case 1: case 2:` gives two labels one body.
function classify(n: number): number {
  switch (n) {
    case 0:
      return 10;
    case 1:
    case 2:
      return 20;
    case -1:
      return 30;
    default:
      return 40;
  }
}

export function test(): number {
  return classify(0) + classify(1) * 2 + classify(2) * 3 + classify(-1) * 4 + classify(9) * 5;
}
