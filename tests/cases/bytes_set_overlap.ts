// WP34 N2: why `set` is a `memmove` unless proven otherwise. Nish itself can
// only overlap an array with itself, but a C host may hand in two headers over
// one buffer (runtime/nish.h, "Passing a host buffer"), and then the copy has to
// read the source first in either direction. `bytes_set_overlap.c` builds a
// forward and a backward overlap and prints the buffer after each.
export const copyInto = (dst: u8[], src: u8[], at: i32): void => {
  dst.set(src, at);
};
