// WP27 S1 x WP18: a generic function is a template that is monomorphised per
// instantiation, which needs a body to stamp out. A C symbol is one function.
declare function f<T>(x: T): i32;

export function main(): i32 {
  return 0;
}
