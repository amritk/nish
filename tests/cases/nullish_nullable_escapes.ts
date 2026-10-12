// A `new` in the default of `??` on a `T | null` goes wherever the `??` goes,
// as a ternary's arm does: here a return value and a field, so both objects
// are allocated in the arena, never in the frame that builds them, and the
// strings `churn` allocates afterwards cannot overwrite them.
class Node {
  label: string;
  next: Node | null = null;
  constructor(label: string) {
    this.label = label;
  }
}

const pick = (n: Node | null, k: string): Node => n ?? new Node(`made ${k}`);

const link = (n: Node, k: string): void => {
  n.next = n.next ?? new Node(`linked ${k}`);
};

const churn = (): i32 => {
  const junk: string[] = [];
  for (let i = 0; i < 200; i++) {
    junk.push(`overwrite ${i} overwrite ${i} overwrite ${i}`);
  }
  return junk.length;
};

export const main = (): i32 => {
  const root = new Node("root");
  link(root, "a");
  link(root, "b");
  const p = pick(null, "p");
  const q = pick(root, "q");
  const n = churn();
  const next = root.next ?? root;
  console.log(`${p.label} ${q.label} ${next.label} ${n}`);
  return 0;
};
