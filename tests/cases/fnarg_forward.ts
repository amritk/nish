// WP29: a function parameter may be passed on, to another function-typed
// parameter, and nowhere else. `twice<i32, square>` asks for
// `applyOnce<i32, square>`: the callee travels as part of the key, so the
// innermost call is still a direct call to `square`.
const applyOnce = <T>(g: (x: T) => T, x: T): T => g(x);

const twice = <T>(f: (x: T) => T, x: T): T => applyOnce(f, applyOnce(f, x));

const square = (x: i32): i32 => x * x;

export const main = (): i32 => {
  console.log(`${twice(square, 3)} ${twice((s: string) => `${s}!`, "hi")}`);
  return 0;
};
