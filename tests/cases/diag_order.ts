// The `performance` stream has a report order of its own — by file, then by
// position, then by diagnostic code — and this case is what pins the two keys
// a one-file program can reach.
//
// **Position.** It is not the order the analysis *finds* the warnings in. A
// generic's body is checked when one of its instantiations is finished rather
// than where the generic is written, so `label`'s warning is found after
// `banner`'s and, before the sort, was printed after it too. A warning computed
// in pass 1 would print ahead of every pass-2 warning of the file for the same
// reason, which is what the sort is really for.
//
// **Code.** Two analyses report at one position in `widened`, and the
// diagnostic code is what orders them, so the pair does not depend on which of
// the two the walk happened to run first.
const label = <T>(items: T[]): string => {
  let s = "";
  let i = 0;
  while (i < items.length) {
    s = s + "?";
    i = i + 1;
  }
  return s;
};

export const banner = (n: i32): string => {
  let out = "";
  let i = 0;
  while (i < n) {
    out = out + "=";
    i = i + 1;
  }
  return out;
};

// Never called on purpose: the multiplication overflows an i32, which is
// undefined behaviour, and this case is linked and run.
export const widened = (): i64 => toI64(100000 * 100000);

export const test = (): number => banner(3).length + label([1, 2, 3]).length;
