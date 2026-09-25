// WP32 (docs/wp32-map.md §5.2): a `boolean` key is zero-extended to 32 bits and
// hashed with `fmix32`; there are exactly two keys.
export const main = (): i32 => {
  const m = new Map<boolean, string>();
  m.set(true, "yes").set(false, "no").set(true, "still yes");
  const both = m.has(true) && m.has(false);
  const gone = m.delete(false);
  console.log(`${both} ${m.size} ${gone} ${m.has(false)} ${m.has(true)}`);
  return 0;
};
