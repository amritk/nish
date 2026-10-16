// A task's arrow does not capture `this`; a `const` bound to it is captured
// as the reference it is.
import { scope } from "nish/threads";

class W {
  k: i32 = 3;

  run(): i32 {
    const out: i32[] = [0];
    {
      using s = scope();
      s.spawn((n: i32): i32 => n + this.k, 1, out, 0);
    }
    return out[0];
  }
}

export const main = (): i32 => new W().run();
