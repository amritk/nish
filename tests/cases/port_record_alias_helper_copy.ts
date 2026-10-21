// #620: NL8003 for a copy done in a helper. `add` pushes the record it is
// handed into the array it is handed, so the call copies `p` into `ps`, and
// the write through `ps[0]` is not seen through `p` natively.
interface Rec {
  v: i32;
}

const add = (xs: Rec[], r: Rec): void => {
  xs.push(r);
};

export const main = (): number => {
  const ps: Rec[] = [];
  const p: Rec = { v: 1 };
  add(ps, p);
  ps[0].v = 5;
  console.log(p.v);
  return 0;
};
