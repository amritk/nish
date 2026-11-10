// NL3052: A value of an interface type may hold a class instance with more fields; Node
// copies all of them and the native copy only the interface's, so a spread of
// such an interface is refused.
interface Named {
  name: i32;
}

interface Tagged {
  name: i32;
  tag: i32;
}

class Item implements Named {
  name: i32 = 1;
  weight: i32 = 2;
}

export const tag = (n: Named): i32 => {
  const t: Tagged = { ...n, tag: 3 };
  return t.tag;
};

export const main = (): i32 => tag(new Item());
