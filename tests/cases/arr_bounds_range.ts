// A computed index is proved by the values it can take. `r` and `c` are each
// below 8 by their loops, so `c + r` and `c - r + 7` are in [0, 14], below the
// 16 the arrays were made with, and `r * 4 + c` over a 4 by 4 board is in
// [0, 15]. The arithmetic is checked, so each value is exact. Every function
// here keeps no bounds check.
const diagonals = (): i32 => {
  const up = new Array<i32>(16);
  const down = new Array<i32>(16);
  let hits = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      up[c + r] = up[c + r] + 1;
      down[c - r + 7] = down[c - r + 7] + 1;
    }
  }
  for (let k = 0; k < 16; k++) {
    hits = hits + up[k] * down[k];
  }
  return hits;
};

const board = (): i32 => {
  const cells = new Array<i32>(16);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      cells[r * 4 + c] = r - c;
    }
  }
  let total = 0;
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      total = total + cells[r * 4 + c] * cells[c * 4 + r];
    }
  }
  return total;
};

export const main = (): number => {
  console.log(`${diagonals()}`);
  console.log(`${board()}`);
  return 0;
};
