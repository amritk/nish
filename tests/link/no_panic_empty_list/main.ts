// An empty `noPanic` list takes no module out of the no-panic default: the
// list only names what `--allow-panics` leaves in the scope. `args` spells the
// default out as `--deny-panics`, because the harness passes `--allow-panics`
// to every other program.
export const main = (): i32 => {
  const xs: i32[] = [1, 2, 3];
  return xs[parseInt("1")];
};
