// A `for...of` binding is a local too: a loop that only counts its turns
// names the element `_x` (NL2712).
export const main = (): i32 => {
  let turns: i32 = 0;
  for (const x of [7, 8, 9]) {
    turns = turns + 1;
  }
  return turns - 3;
};
