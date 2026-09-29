// There are no casts: `x as T` to a type other than `any` or `unknown` is the
// checker's, named by TypeScript's kind.
export const run = (n: i32): i32 => n as i32
