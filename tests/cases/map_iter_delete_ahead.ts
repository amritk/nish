// WP32 (docs/wp32-map.md §6.2, third row): a key deleted during a walk before
// the walk reaches it is skipped; deleting the key being visited, or one
// already visited, changes nothing about the rest of the walk.
export const main = (): i32 => {
  const m = new Map<number, number>();
  for (let i = 0; i < 8; i++) {
    m.set(i, i);
  }
  for (const k of m.keys()) {
    console.log(`${k}`);
    if (k === 1) {
      m.delete(3);
      m.delete(1);
      m.delete(0);
    }
    if (k === 4) {
      m.delete(7);
    }
  }
  console.log(`size ${m.size}`);
  return 0;
};
