// `indexOf` scans with `amrit_str_at` (no runtime search function, so
// `runtime.c` stays inside its budget); `startsWith` / `endsWith` are one
// `amrit_str_at` each.
function find(s: string, needle: string): number {
  return s.indexOf(needle);
}

function test(): number {
  const s = "one,two";
  let flags = 0;
  if (s.startsWith("one")) flags += 1;
  if (s.endsWith("two")) flags += 2;
  if (s.endsWith("one,two,three")) flags += 4;
  if (String.fromCharCode(44) === ",") flags += 8;
  return find(s, ",") * 1000 + find(s, "zzz") + flags;
}
