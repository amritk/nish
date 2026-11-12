// A generic `declare class` has no layout until `T` is bound, and a C struct
// has no type parameters, so the checker refuses the template outright.
declare class Box<T> {
  value: T;
}
