// `~` needs an integer: JavaScript's `~2.5` truncates through ToInt32 first,
// and Nish never converts implicitly (write `~toI32(a)`).
export const test = (a: f64): f64 => {
  return ~a;
};
