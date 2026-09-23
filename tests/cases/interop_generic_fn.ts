// WP18 G8: every exported instantiation reaches a host under one name that is
// a C identifier *and* a JavaScript one. The mangling puts `$` in each symbol
// and `.` in the ones whose argument is an array, a readonly array, a nullable
// or a `Result` (`identity$arr.i32`), so neither language can spell the symbol
// itself: the header binds `nish_gen_identity_arr_i32` to it with an asm label,
// and the `.d.ts`, the wasm loader and the N-API addon export that same name.
// tests/run.js compiles the sidecars with clang, tsc and Node and calls them.
export class Box<T> {
  value: T;

  constructor(v: T) {
    this.value = v;
  }

  get(): T {
    return this.value;
  }
}

export const identity = <T>(x: T): T => x;

// Each of these asks for `identity` at a type whose mangling holds a `.`:
// `roarr.i32`, `opt.$Box$i32` and `res.i32.i32`.
const firstOf = (xs: readonly i32[]): i32 => identity(xs)[0];

const orZero = (b: Box<i32> | null): i32 => {
  const same = identity(b);
  if (same !== null) {
    return same.value;
  }
  return 0;
};

const okOr = (r: Result<i32, i32>, other: i32): i32 => {
  const same = identity(r);
  if (same.isOk()) {
    return same.value;
  }
  return other;
};

export const test = (): number => {
  const xs: i32[] = [4, 5, 6];
  const box = identity(new Box<i32>(20));
  return (
    identity(1) +
    identity("four").length +
    identity(xs).length +
    box.get() +
    orZero(box) +
    firstOf(xs) +
    okOr(Ok(3), 0)
  );
};
