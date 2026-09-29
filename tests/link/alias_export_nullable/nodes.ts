export class Node {
  value: i32;
  next: Link;

  constructor(value: i32, next: Link) {
    this.value = value;
    this.next = next;
  }
}

// A `T | null` alias, named by the class it is the nullable form of before
// the alias is written: the right-hand side is resolved by need.
export type Link = Node | null;
