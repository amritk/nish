// NL2326: a constraint that mentions a type parameter (WP18 G6). A constraint
// is resolved once for the template, with nothing bound, so a bound that
// depends on another parameter would mean something different at every
// instantiation; that is where an F-bounded constraint starts, and it is out of
// this path.
interface Container<T> {
  value: T;
}

export const unwrap = <T, U extends Container<T>>(c: U, fallback: T): T => fallback;

export const main = (): i32 => 0;
