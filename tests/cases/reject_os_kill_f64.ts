// WP34 N12: a signal is an i32 in either number mode; an f64 is refused, not converted.
export const main = (): i32 => {
  const sig: number = 15;
  return kill(1, sig);
};
