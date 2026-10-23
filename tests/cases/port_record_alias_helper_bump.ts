// #620: NL8003 for a helper that writes the record it is handed. `bump`
// writes a field of `r`, so `bump(p)` is a write to `p` after it was copied
// into `ps`, and the read through `ps[0]` sees it in TypeScript only.
interface Rec {
  v: i32;
}

const bump = (r: Rec): void => {
  r.v = r.v + 4;
};

export const main = (): number => {
  const ps: Rec[] = [];
  const p: Rec = { v: 1 };
  ps.push(p);
  bump(p);
  console.log(ps[0].v);
  return 0;
};
