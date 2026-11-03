// NL2613: a `Map` of handles sent on a channel crosses to another thread.
import { Region, enter, enterWith, free, region, regionWith } from "nish:region";
import { Channel, scope } from "nish/threads";

class Box {
  n: i32 = 0;
  items: i32[];
  constructor() {
    this.items = [];
  }
}

const send = (ch: Channel<Map<i32, Region<Box>>>): i32 => {
  const m = new Map<i32, Region<Box>>();
  m.set(1, region((): Box => new Box()));
  ch.send(m);
  return 0;
};

export const main = (): i32 => {
  const ch = new Channel<Map<i32, Region<Box>>>();
  const out: i32[] = [0];
  {
    using s = scope();
    s.spawn(send, ch, out, 0);
  }
  return out[0];
};
