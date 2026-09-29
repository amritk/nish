// WP34 N2: a range past the end, or a negative offset, panics through the
// slice check and prints the range `set` asked to write. `bytes_set_oob.c`
// runs each in a child and prints its message and its exit status.
const into = (at: i32): i32 => {
  const dst: u8[] = [0, 0, 0, 0, 0, 0];
  const src: u8[] = [1, 2, 3];
  dst.set(src, at);
  return toI32(dst[at]);
};

export const pastEnd = (): i32 => into(4);

export const negative = (): i32 => into(-1);

export const test = (): i32 => into(3);
