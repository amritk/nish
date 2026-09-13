// WP15 §2a: the array owns its element storage, so a record entering it is
// copied into the slot and the slot is what the array hands back. `push` then
// `pop` round-trips through one block, and `indexOf` still answers by identity
// — which for a contiguous array means "the same slot".
interface Cell {
  v: number;
}

export const test = (): number => {
  const cells: Cell[] = [];
  cells.push({ v: 1 });
  cells.push({ v: 2 });
  cells.push({ v: 3 });
  // The copy is visible here: writing through the slot is what changes the
  // array, and reading it back proves the write landed in the block.
  cells[0].v = 40;
  const found = cells.indexOf(cells[2]);
  const last = cells.pop();
  return cells[0].v + cells[1].v + last.v + found;
};
