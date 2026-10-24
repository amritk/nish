// `terminalSize` answers a fresh `[columns, rows]` from the arena, so a
// function that returns it must not get an automatic arena scope (WP6): the
// scope's `nish_arena_release` would rewind past the pair before the caller
// reads it, and the next allocation would overwrite it. With stdout a pipe and
// stdin `/dev/null`, the call answers `[-25, 0]` (not a terminal), which this
// reads back after 320 bytes of allocation on top.
//
// The template literal gives the function an allocation that does flow
// locally, so there is a scope to get wrong, as in `mem_wait_pid_scope`.
import { terminalSize } from "nish:term";

const measure = (who: string): i32[] => {
  const label = `measure ${who}`;
  console.log(label);
  return terminalSize();
};

export const main = (): number => {
  const pair = measure("stdout");
  let filler = "";
  for (let i = 0; i < 40; i++) {
    filler = `${filler}ZZZZZZZZ`;
  }
  console.log(`filled ${filler.length}`);
  console.log(`pair: ${pair[0]} ${pair[1]}`);
  return 0;
};
