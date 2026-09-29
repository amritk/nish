// WP33 NL8004, the quiet side for `pop`: a reference bound to `ps.pop()` holds
// the slot the pop dropped, which no in-bounds store can reach, so a store
// into the array afterwards leaves what it reads alone in both readings. (A
// later `push` that reuses the slot is refused by the checker already.) `r` is
// read by a comparison rather than a field, because `tsc` types `pop()` as
// `T | undefined` and refuses the field read (runtime/nish.d.ts).
interface Rec {
  x: i32;
}

export const main = (): number => {
  const ps: Rec[] = [];
  ps.push({ x: 1 });
  ps.push({ x: 2 });
  const q: Rec = { x: 2 };
  const r = ps.pop();
  ps[0] = { x: 7 };
  console.log(r === q ? 1 : 0);
  console.log(ps[0].x);
  return 0;
};
