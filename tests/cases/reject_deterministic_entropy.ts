// --deterministic refuses `entropy` (NL2698): `Math.random` is seeded from the time.
export const main = (): number => {
  console.log(Math.random() < 1.0);
  return 0;
};
