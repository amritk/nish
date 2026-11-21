// An empty `noPanic` list takes no module out of the no-panic default: the
// list only names what `--allow-panics` leaves in the scope. `strict` keeps
// the harness from passing `--allow-panics`, as it does to every other
// program, so this builds as a user's would.
export const main = (): i32 => {
  const xs: i32[] = [1, 2, 3];
  return xs[parseInt("1")];
};
