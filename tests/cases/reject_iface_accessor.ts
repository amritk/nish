// An accessor signature in an interface is a method with no body, and an
// interface is fields only. `get` and `set` are still an interface's field
// names wherever a name can stand (`tests/parser/names-bindings.ts`).
export interface Sized {
  get: i32;
  get size(): i32;
  set size(n);
}
