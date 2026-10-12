// A chain in a template hole prints `undefined` under Node where a link is
// `null`, so it needs a default like anywhere else.
class Node {
  value: i32 = 1;
  next: Node | null = null;
  take(x: i32): i32 {
    return x;
  }
}

export const f = (a: Node | null): string => `${a?.value}`;
