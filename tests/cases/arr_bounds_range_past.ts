// A range is a proof only below a length the state knows: `c + r` reaches 14,
// and this array holds 14, so the check stays and the last pass panics with
// `index out of range: 14 >= 14`.
const diagonals = (): i32 => {
  const up = new Array<i32>(14);
  let total = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      total = total + up[c + r];
    }
  }
  return total;
};

export const main = (): number => {
  console.log(`${diagonals()}`);
  return 0;
};
