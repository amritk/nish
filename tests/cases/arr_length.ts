// Only reads: `xs` is `readonly nocapture` and `len` is a `readonly` function.
function len(xs: number[]): number {
  return xs.length;
}

function last(xs: string[]): string {
  return xs[xs.length - 1];
}

export function main(): number {
  console.log(len([1, 2, 3, 4, 5]));
  const empty: number[] = [];
  console.log(len(empty));
  console.log(last(["a", "b", "c"]));
  return 0;
}
