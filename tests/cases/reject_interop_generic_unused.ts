// WP18 G8, docs/wp18-generics.md §8 message 9: an exported generic that the
// program never instantiates has no symbol, so a header, a `.d.ts` or an N-API
// shim would leave it out without a word. With a sidecar flag that is an
// error at the template; tests/run.js compiles the same file without one and
// it succeeds, because the IR alone describes nothing the host looks for.
export const identity = <T>(x: T): T => x;

export class Box<T> {
  value: T;

  constructor(v: T) {
    this.value = v;
  }
}

export const test = (): number => 1;
