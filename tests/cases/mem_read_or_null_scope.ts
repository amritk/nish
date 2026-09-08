// `readFileSyncOrNull` bumps its result out of the arena exactly as
// `readFileSync` does, so a function that returns it must not get an automatic
// arena scope (WP6): the scope's `amrit_arena_release` would rewind past the
// bytes the caller is about to read. The template literal is here to give the
// function an allocation that *does* flow locally, which is what made the
// missing site visible.
export function load(path: string): string | null {
  const label = `read ${path}`;
  console.log(label);
  return readFileSyncOrNull(path);
}
