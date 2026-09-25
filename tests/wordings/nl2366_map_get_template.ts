// NL2366: a `V | undefined` as a template hole.
export const main = (): i32 => {
  const m = new Map<string, i32>();
  console.log(`${m.get("a")}`);
  return 0;
};
