// --deterministic refuses `entropy` (NL2700): `Math.random` is seeded from the time.
export const main = (): number => {
  console.log(Math.random() < 1.0);
  return 0;
};
