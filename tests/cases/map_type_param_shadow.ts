// WP32 (docs/wp32-map.md §4.2): a type parameter called `Map` or `Set` shadows
// the global inside the declaration that binds it, as it does under `tsc`. None
// of the three forms here names the global collections, so nothing is loaded,
// and the IR is what the compiler wrote before `Map` and `Set` existed.
const id = <Map>(x: Map): Map => x;

function pick<Set, T>(a: Set, b: T): Set {
  return a;
}

class Box<Map> {
  v: Map;
  constructor(v: Map) {
    this.v = v;
  }
}

export const main = (): i32 => {
  const b = new Box<i32>(4);
  const x: i32 = id(3);
  const s: string = pick("s", 1);
  console.log(`${x} ${s} ${b.v}`);
  return 0;
};
