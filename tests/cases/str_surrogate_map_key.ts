// A Map key spelled as a surrogate-pair escape is the key spelled as the
// emoji or the braced escape (issue #246): all three are the same four bytes,
// so they hash and compare as one key.
export const main = (): i32 => {
  const m = new Map<string, i32>();
  m.set("\uD83D\uDE00", 1);
  m.set("😀", 2);
  console.log(`${m.size} ${m.has("\u{1F600}")} ${m.get("\u{1F600}") ?? 0}`);
  return 0;
};
