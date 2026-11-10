// A child's builder keeps parent nodes in a list it made and the child reads
// them after the parent's `enter` has returned (NL2614 accepts the pushes).
import { Region, childWith, enter, free, region } from "nish:region";

class Item {
  name: string;
  constructor(name: string) {
    this.name = name;
  }
}

class Tree {
  items: Item[];
  constructor() {
    this.items = [new Item("a"), new Item("b"), new Item("c")];
  }
}

class Seen {
  nodes: Item[];
  constructor() {
    this.nodes = [];
  }
}

const collect = (tree: Tree): Seen => {
  const s = new Seen();
  for (const item of tree.items) {
    s.nodes.push(item);
  }
  s.nodes.push(tree.items[0]);
  return s;
};

const report = (s: Seen): i32 => {
  const names: string[] = [];
  for (const item of s.nodes) {
    names.push(item.name);
  }
  console.log(`${names.join("")} ${s.nodes.length}`);
  return s.nodes.length;
};

const make = (tree: Tree): Region<Seen> => childWith(tree, collect);

export const main = (): i32 => {
  const p = region((): Tree => new Tree());
  const c = enter(p, make);
  const n = enter(c, report);
  free(c);
  free(p);
  return n === 4 ? 0 : 1;
};
