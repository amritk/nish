// WP35: `monotonicNanos` is `clock`, reached from `main` through `now`. The
// output says only that the clock did not run backwards, which is the one
// thing a golden can say about a clock.
const now = (): i64 => monotonicNanos();

export const main = (): number => {
  const start = now();
  console.log(now() >= start);
  return 0;
};
