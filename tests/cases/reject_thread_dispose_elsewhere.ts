// `[Symbol.dispose]` belongs to `nish/threads`'s scope alone: `using` takes
// nothing else, so any other class's would never be called.
class Handle {
  n: i32 = 0;
  [Symbol.dispose](): void {}
}

export const main = (): i32 => new Handle().n;
