// WP9: the returned temporary does not have to be concatenated for the reclaim
// to be sound. It is *kept*, not freed — `amrit_arena_keep` relocates it and
// answers its new address — so what the caller does with it afterwards is its
// own business: pass it on, store it, return it. Only the bytes the callee
// bumped underneath it are released, and `allocEscapes` is what proves those
// are unreachable.
//
// Every call below is bracketed, and each one uses the *kept* pointer: passing
// the temporary to `shout` (`stack` is an argument, not a concatenation),
// handing it straight back out of `twice`, and storing it in a `const`.
function tag(i: number): string {
  return `#${i}`;
}

function shout(s: string): string {
  return s + "!";
}

function twice(i: number): string {
  return shout(tag(i));
}

export function main(): number {
  const held = tag(7);
  console.log(twice(1));
  console.log(held);
  return 0;
}
