// WP32 (docs/wp32-map.md §4.2): a type parameter never shadows a class name in
// scope, so in a module that uses the global `Map`, a type parameter called
// `Map` is the generic class written without its type arguments.
class Box<Map> {
  v: Map;
  constructor(v: Map) {
    this.v = v;
  }
}

export const main = (): i32 => {
  const m = new Map<string, i32>();
  m.set("a", 1);
  const b = new Box<i32>(9);
  console.log(`${m.size} ${b.v}`);
  return 0;
};
