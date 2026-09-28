// `fill`'s value is stored into every slot, so it is the element type, as
// `indexOf`'s argument is.
export const main = (): i32 => {
  const a: u8[] = [0, 0];
  a.fill("x");
  return 0;
};
