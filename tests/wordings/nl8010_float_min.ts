// NL8010: `Math.min` of doubles drops a NaN here, where JavaScript answers NaN.
export const main = (): number => {
  const x: f64 = 0.5;
  const low = Math.min(x, 1.5);
  return toI32(low);
};
