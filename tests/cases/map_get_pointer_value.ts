// WP32 (docs/wp32-map.md §3.2): a class value comes back as its pointer, and
// for a nullable value `??` replaces a stored `null` as well as a missing key,
// as JavaScript's does, while `!== undefined` narrows to `Node | null`.
class Node {
  label: string;
  constructor(label: string) {
    this.label = label;
  }
}

export const main = (): i32 => {
  const fallback = new Node("fallback");
  const nodes = new Map<string, Node>();
  nodes.set("x", new Node("x"));
  console.log(`${(nodes.get("x") ?? fallback).label} ${(nodes.get("y") ?? fallback).label}`);
  const links = new Map<string, Node | null>();
  links.set("x", new Node("linked"));
  links.set("n", null);
  // `??` has the value's type, `Node | null`, whatever it replaced.
  const linked = links.get("x") ?? fallback;
  const stored = links.get("n") ?? fallback;
  const missing = links.get("y") ?? fallback;
  if (linked !== null && stored !== null && missing !== null) {
    console.log(`${linked.label} ${stored.label} ${missing.label}`);
  }
  const n: Node | null | undefined = links.get("n");
  if (n !== undefined) {
    console.log(n === null ? "stored null" : n.label);
  }
  const x = links.get("x");
  if (x !== undefined && x !== null) {
    console.log(x.label);
  }
  return 0;
};
