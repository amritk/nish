// The same through an arrow task's capture: `h.b = box` puts the captured
// object in the task's own `h`, and `h.b.bump()` writes it.
import { scope } from "nish/threads";
class Box {
  n: i32 = 0;

  bump(): void {
    this.n = this.n + 1;
  }
}
class HB {
  b: Box;

  constructor(b: Box) {
    this.b = b;
  }
}

export const main = (): i32 => {
  const box = new Box();
  {
    using s = scope();
    s.spawn(() => {
      const h = new HB(new Box());
      h.b = box;
      h.b.bump();
    });
  }
  return box.n;
};
