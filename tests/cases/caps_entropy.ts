// WP35: `Math.random` is `entropy`, though it is a pseudo-random generator:
// the runtime seeds it from the time and the process id, so two runs answer
// differently. `main` reaches it through `roll`.
const roll = (): f64 => Math.random();

export const main = (): number => {
  const r = roll();
  console.log(r >= 0.0 && r < 1.0);
  return 0;
};
