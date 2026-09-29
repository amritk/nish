// WP34 N2: the Node reading of an out-of-range float offset. Natively the
// saturated offset fails `set`'s range check; under `runtime/nish.mjs` the same
// offset fails the prelude's check. Both print the first line and exit 1, which
// is what the unmodified-Node run compares (the panic's words differ only in
// how each side spells 1e300). No `.out`: the case exits 1 on purpose.
export const main = (): i32 => {
  const dst: u8[] = [0, 0, 0, 0];
  const src: u8[] = [1];
  dst.set(src, 3.5);
  console.log(`${dst[3]}`);
  dst.set(src, 1e300);
  console.log("unreachable");
  return 0;
};
