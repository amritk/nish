// WP33 NL8003 through a second name: arrays are references, so `qs` is `ps`,
// and the write to `p` after it was copied into `ps` is not seen through `qs`
// natively and is in TypeScript. The row matches an array the body puts under
// a second name by its element type, so the read through `qs` is found.
interface Rec {
  x: i32;
}

export const main = (): number => {
  const ps: Rec[] = [];
  const p: Rec = { x: 1 };
  ps.push(p);
  const qs: Rec[] = ps;
  p.x = 9;
  console.log(qs[0].x);
  return 0;
};
