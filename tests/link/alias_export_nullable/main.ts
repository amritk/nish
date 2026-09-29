// An imported `T | null` alias: `null` is a `Link`, a `Link` narrows on
// `!== null`, and a function over it walks the list `nodes.ts` builds.
import { Link, Node } from "./nodes";

const sum = (head: Link): i32 => {
  let total = 0;
  let at: Link = head;
  while (at !== null) {
    total = total + at.value;
    at = at.next;
  }
  return total;
};

export const main = (): number => {
  let head: Link = null;
  for (let i: i32 = 1; i <= 4; i++) {
    head = new Node(i, head);
  }
  console.log(`${sum(head)} ${sum(null)}`);
  return sum(head) === 10 ? 0 : 1;
};
