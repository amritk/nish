// A program with a real error is told that error alone: `unused` would be
// refused too (NL2712), but those findings are held until every other rule
// passes, so they never bury the one that matters.
export const main = (): i32 => {
  const unused: i32 = 1;
  const s: string = 5;
  return 0;
};
