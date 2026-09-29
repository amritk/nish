// WP34 N5: a descriptor is an `i32` in either number mode, so an `f64` one is
// refused rather than converted.
export const main = (): number => {
  const fd: f64 = 3;
  return netClose(fd);
};
