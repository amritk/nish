// `T | null` (WP6): nullable fields, params, returns and locals; narrowing by
// `!== null` / `=== null` in `if`, early return, `while`, `&&` and `?:`.
class Node {
  value: number;
  next: Node | null = null;

  constructor(value: number) {
    this.value = value;
  }
}

function sum(head: Node | null): number {
  let total = 0;
  let cur: Node | null = head;
  while (cur !== null) {
    total += cur.value;
    cur = cur.next;
  }
  return total;
}

function find(head: Node | null, want: number): Node | null {
  let cur = head;
  while (cur !== null && cur.value !== want) {
    cur = cur.next;
  }
  return cur;
}

function describe(n: Node | null): string {
  if (n === null) {
    return "none";
  }
  return `node ${n.value}`;
}

function valueOr(n: Node | null, fallback: number): number {
  return n !== null ? n.value : fallback;
}

function last(head: Node): Node {
  let cur = head;
  let next = cur.next;
  while (next !== null) {
    cur = next;
    next = cur.next;
  }
  return cur;
}

export function main(): number {
  const a = new Node(1);
  const b = new Node(2);
  const c = new Node(3);
  a.next = b;
  b.next = c;
  console.log(sum(a));
  console.log(sum(null));
  console.log(describe(find(a, 2)));
  console.log(describe(find(a, 9)));
  console.log(valueOr(find(a, 3), -1));
  console.log(valueOr(null, -1));
  console.log(last(a).value);
  let s: string | null = null;
  console.log(s === null);
  s = "text";
  if (s !== null) {
    console.log(s.length);
  }
  const xs = new Array<Node | null>(2);
  xs[1] = c;
  const x0 = xs[0];
  console.log(x0 === null);
  const x1 = xs[1];
  if (x1 !== null) {
    console.log(x1.value);
  }
  return 0;
}
