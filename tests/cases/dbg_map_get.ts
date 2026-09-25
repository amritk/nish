// WP32: under `-g` a `const` bound to `Map.get` is two SSA values rather than a
// slot, so it is described with `llvm.dbg.value` of its payload, and a debugger
// sees `n` where the checker lets the program read it.
export const main = (): i32 => {
  const m = new Map<string, i32>();
  m.set("a", 4);
  const n = m.get("a");
  if (n !== undefined) {
    console.log(`${n}`);
  }
  return 0;
};
