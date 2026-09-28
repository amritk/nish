// NL2247: a call to a name that is no function, builtin or local. It used to
// be provoked only as the cascade after a refused `const alias = double`, which
// #275 silenced, so the rule has a program of its own.
export const main = (): i32 => {
  return nope(1);
};
