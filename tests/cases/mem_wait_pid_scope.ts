// `waitPid` answers a fresh `[pid, status]` from the arena, so a function that
// returns it must not get an automatic arena scope (WP6): the scope's
// `nish_arena_release` would rewind past the pair before the caller reads it,
// and the next allocation would overwrite it. With no child to reap, the call
// answers `[-10, 0]` (ECHILD), which this reads back after 320 bytes of
// allocation on top.
//
// The template literal gives the function an allocation that does flow
// locally, so there is a scope to get wrong, as in `mem_getenv_scope`.
import { waitPid } from "nish:process";

const reap = (who: string): i32[] => {
  const label = `reap ${who}`;
  console.log(label);
  return waitPid(-1, 1);
};

export const main = (): number => {
  const pair = reap("any");
  let filler = "";
  for (let i = 0; i < 40; i++) {
    filler = `${filler}ZZZZZZZZ`;
  }
  console.log(`filled ${filler.length}`);
  console.log(`pair: ${pair[0]} ${pair[1]}`);
  return 0;
};
