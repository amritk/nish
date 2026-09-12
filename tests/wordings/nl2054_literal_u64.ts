// NL2054: An unsigned literal past 2^53 was already rounded by the parser, and the message names the width.
export const main = (): i32 => {
  const x: u64 = 18014398509481985;
  return 0;
};
