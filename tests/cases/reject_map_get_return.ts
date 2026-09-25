// WP32: `get` answers `V | undefined`, which does not cross a call, so it cannot be returned.
export const main = (): i32 => {
  const m = new Map<string, i32>();
  m.set("a", 1);
  return m.get("a");
};
