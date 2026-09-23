// NL2329: a member of an unconstrained type parameter (WP18 §8 message 8), in
// the write form. `T` is `Cell` at the one instantiation, and the language
// still says `T` has no members until a constraint names them.
class Cell {
  value: i32 = 0;
}

const reset = <T>(c: T): void => {
  c.value = 0;
};

export const main = (): i32 => {
  reset(new Cell());
  return 0;
};
