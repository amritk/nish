// NL2225: A call goes to a named function; a parenthesised callee is the first step towards a function value.
const one = (): i32 => 1;

export const main = (): i32 => {
  return (one)();
};
