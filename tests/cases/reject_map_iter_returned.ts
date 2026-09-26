// WP32 (docs/wp32-map.md §6.2): an iterator is not a value, so `keys()` cannot be
// returned, from a block body or a concise one.
const keysOf = (s: Set<string>): string[] => s.keys();

export const main = (): i32 => keysOf(new Set<string>()).length;
