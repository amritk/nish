// NL2195: Two locals of one name in one scope have two slots and one reader.
export const main = (): i32 => {
  let x: i32 = 1;
  let x: i32 = 2;
  return x;
};
