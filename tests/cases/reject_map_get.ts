// WP32: `get` answers `V | undefined`, which lands in the next stage; until then it is refused by name.
export const main = (): i32 => {
  const m = new Map<string, i32>();
  m.set("a", 1);
  return m.get("a");
};
