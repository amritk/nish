// The negative of `bounds_exit_guard` for a shadowed name: `process` here is
// a parameter, so `process.exit(3)` is a method call that returns, and the
// check on `xs[i]` stays. Out of range, the access panics with the index error
// rather than reading past the array.
class Proc {
  calls: number = 0;
  exit(code: number): void {
    this.calls = this.calls + code;
  }
}

const pick = (process: Proc, xs: number[], i: number): number => {
  if (i < 0 || i >= xs.length) {
    process.exit(3);
  }
  return xs[i];
};

export const test = (): number => pick(new Proc(), [10, 20, 30], 2);
