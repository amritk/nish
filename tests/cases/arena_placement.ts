// --emit-arena: one site per placement, each where the emitter puts it.
class Point {
  x: i32;
  y: i32;
  constructor(x: i32, y: i32) {
    this.x = x;
    this.y = y;
  }
}

class Holder {
  last: string = "";
}

// `function`: a scalar function whose temporaries all die with it.
const width = (n: i32): i32 => {
  const s = `${n}`;
  return s.length;
};

// `returned`, and `caller` for the temporary every call reclaims.
const label = (n: i32): string => {
  const prefix = `#${n}`;
  return `${prefix}!`;
};

// `unscoped`: reassigning a local takes the function's scope away, and nothing
// here earns one back, so every pass's string stays until the caller's memory
// goes; it accumulates, because the loop releases nothing per pass either.
const retain = (n: i32): i32 => {
  let last = "";
  for (let i = 0; i < n; i++) {
    last = `r${i}`;
  }
  return last.length;
};

// `kept`: stored into a field of an object the caller passed in.
const remember = (h: Holder, n: i32): void => {
  h.last = `${n}`;
};

export const main = (): void => {
  // `stack`: a point that never leaves `main`.
  const p = new Point(1, 2);
  let total = p.x + p.y;
  // `pass`: each pass's string is released when the pass ends.
  for (let i = 0; i < 3; i++) {
    const s = label(i);
    total = total + s.length + width(i);
  }
  // `block`: released when the block's `using a = arena()` ends.
  {
    using a = arena();
    const t = `block ${total}`;
    total = total + t.length;
  }
  const h = new Holder();
  remember(h, total);
  // `function`: `main` earns a scope through its callees, so the strings this
  // loop drops are released when it returns, but they accumulate until then.
  let last = "";
  for (let i = 0; i < 3; i++) {
    last = `item ${i}`;
  }
  console.log(`${total} ${h.last} ${last} ${retain(3)}`);
};
