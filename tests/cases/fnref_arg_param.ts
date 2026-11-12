// WP51 stage 2: a reference parameter passed straight on as the argument of
// an inline function-typed parameter. `outer`'s `f` is itself a reference
// place, so `apply` is instantiated for it and calls through `f`'s dispatcher,
// whose set is the functions `outer` is called with.
type F = (x: i32) => i32;

const square = (x: i32): i32 => x * x;
const plus1 = (x: i32): i32 => x + 1;

const apply = (f: (x: i32) => i32, x: i32): i32 => f(x);

const outer = (f: F, x: i32): i32 => apply(f, x);

export const main = (): void => {
  console.log(`${outer(square, 3)} ${outer(plus1, 3)}`);
};
