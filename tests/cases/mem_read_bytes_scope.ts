// `readFileBytesSync` bumps its result out of the arena as `readFileSyncOrNull`
// does, so a function that returns it must not get an automatic arena scope
// (WP6): the scope's `nish_arena_release` would rewind past the bytes the
// caller is about to read. The template literal gives the function an
// allocation that *does* flow locally, which is what would make a missing site
// visible.
export const load = (path: string): u8[] | null => {
  const label = `read ${path}`;
  console.log(label);
  return readFileBytesSync(path);
};
