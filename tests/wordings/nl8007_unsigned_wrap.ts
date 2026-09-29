// NL8007: a u8 `+` wraps at 256, where TypeScript keeps counting.
export const main = (): number => {
  const level: u8 = 250;
  const next: u8 = level + 10;
  return toI32(next);
};
