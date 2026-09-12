// NL2089: A local has no undefined state to start in, so it is initialized where it is declared.
export const main = (): i32 => {
  let x: i32;
  return 0;
};
