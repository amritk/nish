// `fresh ?? last` is either operand, as a ternary is either arm: `fresh` is
// made inside the `using a = arena()` block, so `last` would point into freed
// memory after it.
class Node {
  label: string;
  constructor(label: string) {
    this.label = label;
  }
}

const make = (s: string): Node | null => (s.length > 0 ? new Node(s) : null);

export const main = (): i32 => {
  let last = new Node("start");
  {
    using a = arena();
    last = make(`made ${last.label.length}`) ?? last;
  }
  console.log(last.label);
  return 0;
};
