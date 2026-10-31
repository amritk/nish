// `netMss`'s descriptor is an `i32` in either number mode, so an `f64` one is
// refused rather than converted, as every `nish:net` descriptor is.
export const mss = (): i32 => {
  const fd: f64 = 3;
  return netMss(fd);
};
