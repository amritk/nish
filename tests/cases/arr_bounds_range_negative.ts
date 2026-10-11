// A range whose bottom is negative proves nothing: `c - r` goes down to -7,
// so the check stays, and `r = 1, c = 0` panics. The runtime prints the index
// as the unsigned compare saw it, so -1 reads
// `index out of range: 18446744073709551615 >= 16`.
const diagonals = (): i32 => {
  const down = new Array<i32>(16);
  let total = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      total = total + down[c - r];
    }
  }
  return total;
};

export const main = (): number => {
  console.log(`${diagonals()}`);
  return 0;
};
