// WP18 G8, §8 message 9 for a method: an exported class whose generic method no
// call instantiates would be described by a header that silently leaves the
// method out, so with a sidecar flag that is an error at the method.
// tests/run.js compiles the same file without the flag, and it succeeds.
export class Holder {
  value: i32 = 0;

  pick<T>(a: T, b: T): T {
    return a;
  }
}

export const test = (): number => new Holder().value;
