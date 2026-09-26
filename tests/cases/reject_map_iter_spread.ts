// WP32 (docs/wp32-map.md §6.2): spreading an iterator into an array is refused
// before it could be anything: there is no spread in this version.
export const main = (): i32 => {
  const m = new Map<string, i32>();
  const ks = [...m.keys()];
  return ks.length;
};
