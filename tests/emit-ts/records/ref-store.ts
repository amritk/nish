// A store into a slot writes the record already there field by field, so a
// name bound to the element earlier reads the stored fields, and a later
// write to the stored record is not seen through the slot.
interface Cell {
  v: i32;
  w: i32;
}

export const main = (): number => {
  const cs: Cell[] = [{ v: 1, w: 2 }, { v: 3, w: 4 }];
  const first = cs[0];
  const c: Cell = { v: 7, w: 8 };
  cs[0] = c;
  c.v = 9;
  console.log(`${first.v} ${first.w} ${cs[0].v} ${c.v}`);
  return 0;
};
