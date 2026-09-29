// NL2415: a typed-array name has a fixed length, so it has no `push` or `pop`.
export const main = (): i32 => {
  const xs = new Float64Array(2);
  xs.push(1.0);
  return 0;
};
