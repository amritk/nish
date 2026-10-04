// `process` here is a parameter, so `process.exit(3)` is a method call that
// returns and does not end the path: `f` falls off its end without an `i32`.
// Only the builtin `process.exit` lets a non-`void` function end with one.
class Proc {
  calls: number = 0;
  exit(code: number): void {
    this.calls = this.calls + code;
  }
}

const f = (process: Proc): number => {
  process.exit(3);
};

export const test = (): number => f(new Proc());
