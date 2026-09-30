// NL2302: a type parameter list names `T` twice. The second `T` could never be
// bound to anything the first was not, so the list is refused on the second.
function pair<T, T>(a: T, b: T): T {
  return a;
}

export const main = (): i32 => pair(1, 2);
