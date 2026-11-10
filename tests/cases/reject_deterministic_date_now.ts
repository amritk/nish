// --deterministic refuses `Date.now()` (NL2698): the wall clock differs on
// every run, the same as `monotonicNanos`.
export const main = (): number => {
  console.log(Date.now() > 0);
  return 0;
};
