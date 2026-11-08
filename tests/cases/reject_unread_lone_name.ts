// A lone name on a line of its own is not a use, so it cannot quiet the
// rule about the local it names (NL2689).
export const main = (): i32 => {
  const kept: i32 = 41;
  kept;
  return 0;
};
