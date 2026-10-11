// C4: as `reject_channel_ctor_this_stored`, for `this` as an array element.
import { Channel, scope } from "nish/threads";
class Late {
  ch: Channel<i32>;

  constructor(ch: Channel<i32>, h: Hold) {
    this.ch = ch;
    h.ls = [this];
  }

  push(): void {
    this.ch.send(-1);
  }
}

class Hold {
  l: Late | null = null;
  ls: Late[];

  constructor() {
    this.ls = [];
  }
}

const take = (l: Late): i32 => {
  let last: i32 = 0;
  for (const x of l.ch) {
    last = x;
  }
  return last;
};

export const main = (): i32 => {
  const out: i32[] = [0];
  const h = new Hold();
  const ch = new Channel<i32>();
  {
    using s = scope();
    s.spawn(take, new Late(ch, h), out, 0);
  }
  return out[0];
};
