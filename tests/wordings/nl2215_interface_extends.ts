// NL2215: An interface is a layout, so it lists every field rather than inheriting any.
interface Base {
  x: i32;
}

interface Point extends Base {
  y: i32;
}
