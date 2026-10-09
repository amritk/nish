// A function that builds its answer from parts — `parts.push(...)` in a loop,
// then `parts.join(...)` — lets nothing it allocated out: the pushed strings
// are reachable only through `parts`, and nothing reads `parts` but `push`,
// `join` (which copies every part into a fresh string) and `length`. So the
// loop that calls it keeps its per-pass release, and the arena is the same
// height after 1000 calls as after one. The parentheses around the pushed
// value are seen through, and a pushed call result (`tag`) is held the same
// way as a pushed template.
const tag = (i: i32): string => `#${i}`;

const spell = (n: i32): string => {
  const parts: string[] = [];
  for (let i = 0; i < n; i++) {
    parts.push((`<${i}>`));
    parts.push(tag(i));
  }
  if (parts.length === 0) {
    return "";
  }
  return parts.join("-");
};

const run = (calls: i32): string => {
  let total = 0;
  for (let i = 0; i < calls; i++) {
    const s = spell(1 + (i % 9));
    total = total + s.length;
  }
  return `${total}`;
};

/** What `run(calls)` answered, and how far it moved the arena. */
const grows = (calls: i32): string => {
  const before = Arena.used();
  const total = run(calls);
  const grown = Arena.used() - before;
  return `${total} ${grown}`;
};

export const main = (): void => {
  const one = grows(1);
  const many = grows(1000);
  console.log(one);
  console.log(many);
  const g1 = one.substring(one.indexOf(" ") + 1, one.length);
  const g2 = many.substring(many.indexOf(" ") + 1, many.length);
  console.log(g1 === g2 ? "flat" : "grows");
};
