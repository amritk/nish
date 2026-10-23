// WP33 R4: a module that declares a C function cannot be written as
// TypeScript, because the function's body is C and is not in the program.
// The refusal names the way out, --emit-napi, and nothing is written.
declare function labs(n: i64): i64;

export const main = (): number => {
  const n: i64 = -9;
  console.log(labs(n));
  return 0;
};
