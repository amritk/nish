// --deterministic refuses `clock` (NL2700): the time differs on every run.
const now = (): i64 => monotonicNanos();

export const main = (): number => {
  console.log(now() > 0);
  return 0;
};
