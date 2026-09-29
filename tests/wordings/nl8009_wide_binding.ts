// NL8009: an i64 binding is a double in TypeScript.
export const main = (): number => {
  const total: i64 = 3;
  return toI32(total);
};
