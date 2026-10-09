// WP15 §8, the false-positive guards for NL9016: every loop here assigns an
// outer local, and none of them drops a value on every pass, so the compiler
// must say nothing at all.
class Registry {
  items: Item[];
  constructor() {
    this.items = [];
  }
}

class Item {
  id: i32;
  constructor(id: i32) {
    this.id = id;
  }
  attach(r: Registry): void {
    r.items.push(this);
  }
}

class Node {
  value: i32;
  next: Node | null;
  constructor(value: i32, next: Node | null) {
    this.value = value;
    this.next = next;
  }
}

export const main = (): void => {
  const words = ["ant", "bee", "cat", "dog"];

  // A search loop: the assignment is in a branch that ends the loop, so it
  // runs once at most.
  let found = "";
  for (const w of words) {
    if (w.charCodeAt(0) === 99) {
      found = `${w}!`;
      break;
    }
  }

  // Every value is kept in `kept`, so the assignment drops nothing.
  const kept: string[] = [];
  let line = "";
  for (const w of words) {
    line = `<${w}>`;
    kept.push(line);
  }

  // The new node holds the old list: a constructor argument keeps the value.
  let head: Node | null = null;
  for (let i = 1; i <= 4; i++) {
    head = new Node(i, head);
  }

  // Declared inside the loop, so each pass's value is its own binding.
  let lengths = 0;
  for (const w of words) {
    let piece = "";
    piece = `${w}${w}`;
    lengths = lengths + piece.length;
  }

  // Not an allocation: an element read and a template with no hole.
  let pick = "";
  for (let i = 0; i < words.length; i++) {
    pick = words[i];
    pick = `fixed`;
  }

  // A body whose top level ends the loop runs at most once.
  let once = "";
  while (lengths > 0) {
    once = `${lengths}`;
    break;
  }

  // Kept through either arm of a conditional.
  const picks: string[] = [];
  let tag = "";
  for (let i = 0; i < 3; i++) {
    tag = `t${i}`;
    picks.push(i > 0 ? tag : "none");
  }

  // A method called on the value may keep it, as `attach` keeps `this`.
  const reg = new Registry();
  let cur = new Item(0);
  for (let i = 1; i < 4; i++) {
    cur = new Item(i);
    cur.attach(reg);
  }

  // `do ... while (false)` runs its body once.
  let single = "";
  do {
    single = `s${lengths}`;
  } while (false);

  let sum = 0;
  let at: Node | null = head;
  while (at !== null) {
    sum = sum + at.value;
    at = at.next;
  }
  console.log(`${found} ${kept.length} ${line} ${sum} ${lengths} ${pick} ${once}`);
  console.log(`${picks[2]} ${tag} ${reg.items.length} ${cur.id} ${single}`);
};
