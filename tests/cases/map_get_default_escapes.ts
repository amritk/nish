// WP32: a `new` in the default of `??` goes wherever the `??` goes, as a
// ternary's arm does. Here that is a map and a return value, so both objects
// are allocated in the arena, never in the frame that builds them; the strings
// pushed afterwards would overwrite a stack object that the map still held.
class Node {
  label: string;
  constructor(label: string) {
    this.label = label;
  }
}

const pick = (m: Map<string, Node>, k: string): Node => m.get(k) ?? new Node(`made ${k}`);

const fill = (m: Map<string, Node>, k: string): void => {
  m.set(k, m.get(k) ?? new Node(`filled ${k}`));
};

export const main = (): i32 => {
  const m = new Map<string, Node>();
  fill(m, "a");
  const p = pick(m, "b");
  const junk: string[] = [];
  for (let i = 0; i < 100; i++) {
    junk.push(`overwrite ${i}`);
  }
  const a = m.get("a");
  if (a !== undefined) {
    console.log(`${a.label} ${p.label} ${junk.length}`);
  }
  return 0;
};
