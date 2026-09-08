// Printing an `f32` widens to double with `fpext` and reuses
// `amrit_str_from_f64`, so the digits are what JavaScript prints for the same
// value and the runtime needs no second formatter. 0.1 is not representable
// in a float, so this is exactly where a missing rounding step would show.
export function test(): number {
  const tenth: f32 = 0.1;
  const d: f64 = 0.1;
  console.log(tenth);
  console.log(`${tenth} ${tenth + tenth} ${d}`);
  return 0;
}
