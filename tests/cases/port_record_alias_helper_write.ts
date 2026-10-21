// #620: NL8003 for a write done in a helper. `setFirst` writes a field of an
// element of the array it is handed, so the call is a write through `ps`, and
// the later read of `p` sees it in TypeScript and not natively.
interface Rec {
  v: i32;
}

const setFirst = (xs: Rec[]): void => {
  xs[0].v = 5;
};

export const main = (): number => {
  const ps: Rec[] = [];
  const p: Rec = { v: 1 };
  ps.push(p);
  setFirst(ps);
  console.log(p.v);
  return 0;
};
