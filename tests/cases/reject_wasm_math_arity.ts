// On a page module `Math.pow` is `std/math.ts`'s `powF64`; a call with one
// argument is refused by the builtin's arity rule, not by the import's signature.
export function square(x: f64): f64 {
  return Math.pow(x)
}
