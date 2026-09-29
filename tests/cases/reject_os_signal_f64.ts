// WP34 N3: a descriptor is an i32 in either number mode; an f64 is refused, not converted.
export const main = (): i32 => {
  const fd: number = 3;
  return readSignal(fd);
};
