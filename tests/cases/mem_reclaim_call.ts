// WP9: a string-returning function cannot reclaim its own temporaries, because
// the one it returns has to outlive it. The *caller* can: the return value is
// the only thing a call hands back, so once `escape.ts` proves the callee lets
// nothing else out of its frame, everything it bumped underneath that string is
// garbage. `%arena.mark` before the call and `@amrit_arena_keep` after it are
// the bracket; the kept string moves down to the mark.
function piece(i: number): string {
  return `${i},`;
}

function join(n: number): string {
  let s = "";
  for (let i = 0; i < n; i++) {
    s = s + piece(i);
  }
  return s;
}

export function main(): number {
  console.log(join(4));
  return 0;
}
