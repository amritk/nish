// NL2192: A parameter is one value with one layout, so a destructuring pattern has no slot.
interface Point {
  x: i32;
}

const read = ({ x }: Point): i32 => x;
