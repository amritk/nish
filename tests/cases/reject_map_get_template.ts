// WP32: there is no `undefined` to print, so it is no template hole.
export const main = (): i32 => {
  const m = new Map<string, i32>();
  console.log(`${m.get("a")}`);
  return 0;
};
