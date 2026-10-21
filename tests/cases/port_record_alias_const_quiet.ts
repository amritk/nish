// #620's quiet side: the alias `q` of the copied record is read before the
// write through `ps[0]` and never after, so both sides agree and no NL8003.
interface Rec {
  v: i32;
}

export const main = (): number => {
  const ps: Rec[] = [];
  const p: Rec = { v: 1 };
  ps.push(p);
  const q = p;
  console.log(q.v);
  ps[0].v = 5;
  console.log(ps[0].v);
  return 0;
};
