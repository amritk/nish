// WP33 NL8004 through a second name: `qs` is `ps`, so the store through `qs`
// overwrites the slot `r` points at natively, and in TypeScript `r` keeps the
// object the slot held before. The store is matched by element type because
// the body puts the array under a second name.
interface Rec {
  x: i32;
}

export const main = (): number => {
  const ps: Rec[] = [];
  ps.push({ x: 1 });
  ps.push({ x: 2 });
  const r: Rec = ps[0];
  const qs: Rec[] = ps;
  qs[0] = { x: 99 };
  console.log(r.x);
  return 0;
};
