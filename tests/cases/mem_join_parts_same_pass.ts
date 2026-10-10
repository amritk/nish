// The argument a pass builds for itself, handed to a function that only
// pushes it onto its own `parts` and joins them, dies with that pass: `join`
// copies every part into a fresh string, and nothing else reads `parts`, so
// `word` is not kept by `quote` and the loop keeps its per-pass release. The
// arena is the same height after 1000 passes as after one (#503). The
// parentheses around the pushed parameter are seen through.
const quote = (word: string, n: i32): string => {
  const parts: string[] = [];
  for (let i = 0; i < n; i++) {
    parts.push((word));
    parts.push(`${i}`);
  }
  if (parts.length === 0) {
    return "";
  }
  return parts.join(",");
};

const run = (calls: i32): string => {
  let total = 0;
  for (let i = 0; i < calls; i++) {
    const word = `w${i % 7}`;
    const s = quote(word, 1 + (i % 9));
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
