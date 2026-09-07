// `join` is one pass over the lengths, one allocation and one memcpy per
// part: the shape that replaces `s = s + t` in a loop, which is quadratic in
// both time and arena (docs/wp14-selfhost.md §3).
function report(parts: string[]): string {
  return parts.join(", ");
}

function test(): number {
  const parts: string[] = [];
  parts.push("alpha");
  parts.push("beta");
  const empty: string[] = [];
  const one: string[] = ["solo"];
  return report(parts).length * 1000 + one.join("-").length * 10 + empty.join("-").length + parts.join().length;
}
