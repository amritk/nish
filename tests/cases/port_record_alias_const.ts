// #620: NL8003 through a `const` alias of the copied record. `q` is `p`, so
// TypeScript sees the write through `ps[0]` when it reads `q.v`, and native,
// where `ps` holds its own copy of the record, does not. The alias is followed
// back to `p`, so the read through it is found.
interface Rec {
  v: i32;
}

export const main = (): number => {
  const ps: Rec[] = [];
  const p: Rec = { v: 1 };
  ps.push(p);
  const q = p;
  ps[0].v = 5;
  console.log(q.v);
  return 0;
};
