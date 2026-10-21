// WP34 N12: the core count and the memory size are facts about the host, as
// `process.platform` and `process.arch` are, so both are `none`: a program
// that sizes a pool by them reaches nothing, and its capabilities are empty.
export const main = (): number => {
  console.log(availableParallelism() >= 1);
  console.log(totalMemory() > 0);
  return 0;
};
