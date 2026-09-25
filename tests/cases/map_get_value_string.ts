// WP32: a `string` value. A stored "" is found, so `??` keeps it.
export const main = (): i32 => {
  const m = new Map<i32, string>();
  m.set(1, "one").set(2, "");
  const v = m.get(1);
  if (v !== undefined) {
    console.log(`${v.length} [${m.get(2) ?? "none"}] [${m.get(3) ?? "none"}]`);
  }
  return 0;
};
