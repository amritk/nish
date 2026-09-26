// WP32 S5 (docs/wp32-map.md §9.1): not fused. A template literal inside the
// value allocates a string between the probe and the write, so
// `m.set(k, `${m.get(k) ?? ""}!`)` stays a `get` and a `set`.
const shout = (m: Map<string, string>, k: string): void => {
  m.set(k, `${m.get(k) ?? ""}!`);
};

export const main = (): i32 => {
  const m = new Map<string, string>();
  shout(m, "hey");
  shout(m, "hey");
  console.log(`${m.get("hey") ?? "?"} ${m.size}`);
  return 0;
};
