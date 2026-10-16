// The module `tests/run.js` writes an N-API shim for (`--emit-napi`) to read
// the Node-API functions the shim calls (`src/c-symbols.ts`): one export of
// each kind of value the shim converts.
export const add = (a: i32, b: i32): i32 => a + b;

export const scale = (x: f64): f64 => x * 2;

export const greet = (name: string): string => `hello ${name}`;

export const total = (xs: i32[]): i32 => {
  let t: i32 = 0;
  for (const x of xs) {
    t = t + x;
  }
  return t;
};

export const flag = (b: boolean): boolean => !b;
