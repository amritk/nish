// NL2225: a call goes to a named function or through a function reference.
// A callee computed to anything else, here the `i32` that `one()` returns,
// is not a function.
const one = (): i32 => 1;

export const main = (): i32 => {
  return one()();
};
