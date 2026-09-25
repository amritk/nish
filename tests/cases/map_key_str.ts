// WP32 (docs/wp32-map.md §5.2): a string key hashes by FNV-1a over its bytes
// and compares by content (`nish_str_eq`), so a key built at run time finds the
// literal it spells, "" is a key, and a key that differs by one byte is not.
export const main = (): i32 => {
  const m = new Map<string, i32>();
  m.set("apple", 1).set("", 2).set("app", 3);
  const built = `ap${"ple"}`;
  const found = m.has(built) && m.has("") && m.has("app") && !m.has("apples") && !m.has("appla");
  m.set(built, 10);
  const gone = m.delete("app");
  console.log(`${found} ${m.size} ${gone} ${m.delete("app")} ${m.has("app")} ${m.has("apple")}`);
  return 0;
};
