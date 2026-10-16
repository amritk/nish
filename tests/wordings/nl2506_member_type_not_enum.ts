// NL2506: a dotted type whose qualifier is not an enum.
class Box {
  size: i32 = 0;
}

export const main = (): i32 => {
  const n: Box.size = 0;
  return n;
};
