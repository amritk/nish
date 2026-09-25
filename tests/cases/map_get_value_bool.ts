// WP32: a `boolean` value. A stored `false` is found, so `??` keeps it.
export const main = (): i32 => {
  const m = new Map<string, boolean>();
  m.set("no", false);
  const v = m.get("no");
  console.log(`${m.get("no") ?? true} ${m.get("yes") ?? true} ${v !== undefined && !v}`);
  return 0;
};
