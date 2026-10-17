// The six `nish:unsafe` functions are declared as globals for `tsc`, but a
// call is accepted only through the import: the global spelling would be an
// opt-in to undefined behaviour or a defined wrap that nothing at the top of
// the module shows.
declare function getenv(name: string): CPtr | null;

export const f = (xs: i32[], a: i32): i32 => {
  const x = uncheckedGet(xs, 0);
  return wrappingAdd(a, x);
};

export const g = (): string => {
  const p = getenv("HOME");
  return p === null ? "" : readCString(p);
};
