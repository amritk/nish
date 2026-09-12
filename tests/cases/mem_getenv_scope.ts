// `getenv` bumps its result out of the arena, so a function that returns it must
// not get an automatic arena scope (WP6): the scope's `nish_arena_release` rewinds
// past the bytes the caller is about to read. This shipped broken — the value came
// back correct and was overwritten by the next allocation, which is silent
// corruption rather than a crash — so the case pins both halves: no scope in the
// IR golden, and the value still readable after 320 bytes of allocation on top.
//
// The template literal is what made the missing site visible: it gives the
// function an allocation that *does* flow locally, so there is a scope to get
// wrong. `mem_read_or_null_scope` is the same rule for `readFileSyncOrNull`.
const fromEnv = (name: string): string | null => {
  const label = `read ${name}`;
  console.log(label);
  return getenv(name);
};

export const main = (): number => {
  const value = fromEnv("NISH_SCOPE_PROBE");
  if (value === null) {
    console.log("unset");
    return 1;
  }
  let filler = "";
  for (let i = 0; i < 40; i++) {
    filler = `${filler}ZZZZZZZZ`;
  }
  console.log(`filled ${filler.length}`);
  console.log(`value: ${value}`);
  return 0;
};
